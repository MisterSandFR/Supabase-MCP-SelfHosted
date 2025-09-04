import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const ManageRlsPoliciesInputSchema = z.object({
    action: z.enum(['create', 'update', 'delete', 'list', 'enable', 'disable']).describe("Action to perform"),
    tableName: z.string().optional().describe("Table name (schema.table format)"),
    policyName: z.string().optional().describe("Policy name"),
    command: z.enum(['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE']).optional().describe("SQL command"),
    using: z.string().optional().describe("USING expression for row visibility"),
    withCheck: z.string().optional().describe("WITH CHECK expression for data modification"),
    roles: z.array(z.string()).optional().default(['public']).describe("Roles to apply policy to"),
    template: z.enum(['user_owned', 'tenant_isolation', 'public_read', 'admin_only', 'team_based']).optional().describe("Use predefined template")
});

type ManageRlsPoliciesInput = z.infer<typeof ManageRlsPoliciesInputSchema>;

const POLICY_TEMPLATES = {
    user_owned: {
        using: "(auth.uid() = user_id)",
        withCheck: "(auth.uid() = user_id)",
        description: "Users can only access their own data"
    },
    tenant_isolation: {
        using: "(tenant_id = auth.jwt() ->> 'tenant_id')",
        withCheck: "(tenant_id = auth.jwt() ->> 'tenant_id')",
        description: "Multi-tenant isolation based on JWT claims"
    },
    public_read: {
        using: "(true)",
        withCheck: "(auth.role() = 'authenticated')",
        description: "Public read, authenticated write"
    },
    admin_only: {
        using: "(auth.jwt() ->> 'role' = 'admin')",
        withCheck: "(auth.jwt() ->> 'role' = 'admin')",
        description: "Admin-only access"
    },
    team_based: {
        using: "(team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))",
        withCheck: "(team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()))",
        description: "Team-based access control"
    }
};

const ManageRlsPoliciesOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

export const manageRlsPoliciesTool = {
    name: "manage_rls_policies",
    description: "Create, update, delete, and manage Row Level Security policies",
    inputSchema: ManageRlsPoliciesInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["create", "update", "delete", "list", "enable", "disable"],
                description: "Action to perform"
            },
            tableName: {
                type: "string",
                description: "Table name (schema.table format)"
            },
            policyName: {
                type: "string",
                description: "Policy name"
            },
            command: {
                type: "string",
                enum: ["ALL", "SELECT", "INSERT", "UPDATE", "DELETE"],
                description: "SQL command"
            },
            using: {
                type: "string",
                description: "USING expression for row visibility"
            },
            withCheck: {
                type: "string",
                description: "WITH CHECK expression for data modification"
            },
            roles: {
                type: "array",
                items: { type: "string" },
                description: "Roles to apply policy to"
            },
            template: {
                type: "string",
                enum: ["user_owned", "tenant_isolation", "public_read", "admin_only", "team_based"],
                description: "Use predefined template"
            }
        },
        required: ["action"]
    },
    outputSchema: ManageRlsPoliciesOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ManageRlsPoliciesInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'list': {
                const sql = validatedInput.tableName 
                    ? `
                        SELECT 
                            schemaname,
                            tablename,
                            policyname,
                            permissive,
                            roles,
                            cmd,
                            qual AS using_expression,
                            with_check
                        FROM pg_policies
                        WHERE schemaname || '.' || tablename = $1
                        ORDER BY tablename, policyname
                    `
                    : `
                        SELECT 
                            schemaname,
                            tablename,
                            policyname,
                            permissive,
                            roles,
                            cmd,
                            qual AS using_expression,
                            with_check
                        FROM pg_policies
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                        ORDER BY schemaname, tablename, policyname
                    `;
                
                const result = await executeSqlWithFallback(
                    sql, 
                    context,
                    validatedInput.tableName ? [validatedInput.tableName] : undefined
                );
                
                // Check RLS status for tables
                const rlsStatusSql = `
                    SELECT 
                        schemaname || '.' || tablename AS table_name,
                        rowsecurity AS rls_enabled,
                        forcerowsecurity AS force_rls
                    FROM pg_tables
                    WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                    ORDER BY schemaname, tablename
                `;
                
                const rlsStatus = await executeSqlWithFallback(rlsStatusSql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            policies: result.data,
                            rlsStatus: rlsStatus.data,
                            summary: {
                                totalPolicies: result.data.length,
                                tablesWithRls: rlsStatus.data.filter((t: any) => t.rls_enabled).length,
                                tablesWithoutRls: rlsStatus.data.filter((t: any) => !t.rls_enabled).length
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'enable': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for enable action");
                }
                
                const sql = `ALTER TABLE ${validatedInput.tableName} ENABLE ROW LEVEL SECURITY`;
                await executeSqlWithFallback(sql, context);
                
                // Also force RLS for all roles except table owner
                const forceSql = `ALTER TABLE ${validatedInput.tableName} FORCE ROW LEVEL SECURITY`;
                await executeSqlWithFallback(forceSql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `RLS enabled and forced for table ${validatedInput.tableName}`,
                            table: validatedInput.tableName,
                            action: 'enable'
                        }, null, 2)
                    }]
                };
            }
            
            case 'disable': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for disable action");
                }
                
                const sql = `ALTER TABLE ${validatedInput.tableName} DISABLE ROW LEVEL SECURITY`;
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `RLS disabled for table ${validatedInput.tableName}`,
                            table: validatedInput.tableName,
                            action: 'disable',
                            warning: 'Table is now accessible to all users without restrictions!'
                        }, null, 2)
                    }]
                };
            }
            
            case 'create': {
                if (!validatedInput.tableName || !validatedInput.policyName) {
                    throw new Error("Table name and policy name are required for create action");
                }
                
                // Use template if provided
                let using = validatedInput.using;
                let withCheck = validatedInput.withCheck;
                
                if (validatedInput.template && POLICY_TEMPLATES[validatedInput.template]) {
                    const template = POLICY_TEMPLATES[validatedInput.template];
                    using = using || template.using;
                    withCheck = withCheck || template.withCheck;
                }
                
                if (!using) {
                    throw new Error("USING expression is required (either directly or via template)");
                }
                
                const command = validatedInput.command || 'ALL';
                const roles = validatedInput.roles?.join(', ') || 'public';
                
                let sql = `CREATE POLICY "${validatedInput.policyName}" ON ${validatedInput.tableName}`;
                sql += ` FOR ${command}`;
                sql += ` TO ${roles}`;
                sql += ` USING (${using})`;
                
                if (withCheck && ['INSERT', 'UPDATE', 'ALL'].includes(command)) {
                    sql += ` WITH CHECK (${withCheck})`;
                }
                
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `Policy created successfully`,
                            policy: {
                                name: validatedInput.policyName,
                                table: validatedInput.tableName,
                                command,
                                roles: validatedInput.roles,
                                using,
                                withCheck,
                                template: validatedInput.template
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'update': {
                if (!validatedInput.tableName || !validatedInput.policyName) {
                    throw new Error("Table name and policy name are required for update action");
                }
                
                // PostgreSQL doesn't support ALTER POLICY directly, need to drop and recreate
                // First get existing policy details
                const getPolicySql = `
                    SELECT 
                        permissive,
                        roles,
                        cmd,
                        qual AS using_expression,
                        with_check
                    FROM pg_policies
                    WHERE schemaname || '.' || tablename = $1 
                    AND policyname = $2
                `;
                
                const existing = await executeSqlWithFallback(
                    getPolicySql, 
                    context,
                    [validatedInput.tableName, validatedInput.policyName]
                );
                
                if (existing.data.length === 0) {
                    throw new Error(`Policy ${validatedInput.policyName} not found on table ${validatedInput.tableName}`);
                }
                
                const current = existing.data[0];
                
                // Drop existing policy
                await executeSqlWithFallback(
                    `DROP POLICY "${validatedInput.policyName}" ON ${validatedInput.tableName}`,
                    context
                );
                
                // Create new policy with updated values
                const command = validatedInput.command || current.cmd;
                const roles = validatedInput.roles?.join(', ') || current.roles.replace('{', '').replace('}', '');
                const using = validatedInput.using || current.using_expression;
                const withCheck = validatedInput.withCheck || current.with_check;
                
                let sql = `CREATE POLICY "${validatedInput.policyName}" ON ${validatedInput.tableName}`;
                sql += ` FOR ${command}`;
                sql += ` TO ${roles}`;
                sql += ` USING (${using})`;
                
                if (withCheck && ['INSERT', 'UPDATE', 'ALL'].includes(command)) {
                    sql += ` WITH CHECK (${withCheck})`;
                }
                
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `Policy updated successfully`,
                            policy: {
                                name: validatedInput.policyName,
                                table: validatedInput.tableName,
                                command,
                                roles: validatedInput.roles || current.roles,
                                using,
                                withCheck
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'delete': {
                if (!validatedInput.tableName || !validatedInput.policyName) {
                    throw new Error("Table name and policy name are required for delete action");
                }
                
                const sql = `DROP POLICY IF EXISTS "${validatedInput.policyName}" ON ${validatedInput.tableName}`;
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: `Policy deleted successfully`,
                            policy: validatedInput.policyName,
                            table: validatedInput.tableName
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};