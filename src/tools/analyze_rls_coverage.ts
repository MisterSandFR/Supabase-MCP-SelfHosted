import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const AnalyzeRlsCoverageInputSchema = z.object({
    includeSystemTables: z.boolean().optional().default(false).describe("Include system tables in analysis"),
    suggestPolicies: z.boolean().optional().default(true).describe("Suggest policies for unprotected tables"),
    checkOrphans: z.boolean().optional().default(true).describe("Check for orphaned policies")
});

type AnalyzeRlsCoverageInput = z.infer<typeof AnalyzeRlsCoverageInputSchema>;

export const analyzeRlsCoverageTool: Tool = {
    name: "analyze_rls_coverage",
    description: "Analyze RLS coverage, detect unprotected tables, and suggest security improvements",
    inputSchema: {
        type: "object",
        properties: {
            includeSystemTables: {
                type: "boolean",
                description: "Include system tables in analysis"
            },
            suggestPolicies: {
                type: "boolean",
                description: "Suggest policies for unprotected tables"
            },
            checkOrphans: {
                type: "boolean",
                description: "Check for orphaned policies"
            }
        }
    },
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = AnalyzeRlsCoverageInputSchema.parse(input || {});
        
        // Get all tables with RLS status
        const tablesSql = `
            SELECT 
                t.schemaname,
                t.tablename,
                t.rowsecurity AS rls_enabled,
                t.forcerowsecurity AS force_rls,
                obj_description(c.oid) AS table_comment,
                COUNT(pol.policyname) AS policy_count
            FROM pg_tables t
            JOIN pg_class c ON c.relname = t.tablename 
                AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
            LEFT JOIN pg_policies pol ON pol.schemaname = t.schemaname 
                AND pol.tablename = t.tablename
            WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                ${!validatedInput.includeSystemTables ? "AND t.schemaname NOT IN ('auth', 'storage', 'supabase_functions', 'extensions', 'graphql', 'graphql_public', 'pgbouncer', 'pgsodium', 'pgsodium_masks', 'realtime', 'supabase_migrations')" : ""}
            GROUP BY t.schemaname, t.tablename, t.rowsecurity, t.forcerowsecurity, c.oid
            ORDER BY t.schemaname, t.tablename
        `;
        
        const tables = await executeSqlWithFallback(tablesSql, context);
        
        // Analyze table columns to suggest policies
        const suggestions: any[] = [];
        
        if (validatedInput.suggestPolicies) {
            for (const table of tables.data) {
                if (!table.rls_enabled || table.policy_count === 0) {
                    // Get columns to understand table structure
                    const columnsSql = `
                        SELECT 
                            column_name,
                            data_type,
                            is_nullable,
                            column_default
                        FROM information_schema.columns
                        WHERE table_schema = $1 
                        AND table_name = $2
                        ORDER BY ordinal_position
                    `;
                    
                    const columns = await executeSqlWithFallback(
                        columnsSql,
                        context,
                        [table.schemaname, table.tablename]
                    );
                    
                    const columnNames = columns.data.map((c: any) => c.column_name);
                    const suggestedPolicies = [];
                    
                    // Suggest policies based on column patterns
                    if (columnNames.includes('user_id') || columnNames.includes('owner_id')) {
                        suggestedPolicies.push({
                            type: 'user_owned',
                            name: `${table.tablename}_user_policy`,
                            command: 'ALL',
                            using: `(auth.uid() = ${columnNames.includes('user_id') ? 'user_id' : 'owner_id'})`,
                            withCheck: `(auth.uid() = ${columnNames.includes('user_id') ? 'user_id' : 'owner_id'})`,
                            description: 'User can only access their own records'
                        });
                    }
                    
                    if (columnNames.includes('tenant_id') || columnNames.includes('organization_id')) {
                        suggestedPolicies.push({
                            type: 'tenant_isolation',
                            name: `${table.tablename}_tenant_policy`,
                            command: 'ALL',
                            using: `(${columnNames.includes('tenant_id') ? 'tenant_id' : 'organization_id'} = auth.jwt() ->> '${columnNames.includes('tenant_id') ? 'tenant_id' : 'org_id'}')`,
                            withCheck: `(${columnNames.includes('tenant_id') ? 'tenant_id' : 'organization_id'} = auth.jwt() ->> '${columnNames.includes('tenant_id') ? 'tenant_id' : 'org_id'}')`,
                            description: 'Multi-tenant isolation'
                        });
                    }
                    
                    if (columnNames.includes('is_public') || columnNames.includes('published')) {
                        suggestedPolicies.push({
                            type: 'public_read',
                            name: `${table.tablename}_public_read`,
                            command: 'SELECT',
                            using: `(${columnNames.includes('is_public') ? 'is_public' : 'published'} = true)`,
                            description: 'Public read for published content'
                        });
                    }
                    
                    if (columnNames.includes('team_id') || columnNames.includes('group_id')) {
                        suggestedPolicies.push({
                            type: 'team_based',
                            name: `${table.tablename}_team_policy`,
                            command: 'ALL',
                            using: `(${columnNames.includes('team_id') ? 'team_id' : 'group_id'} IN (SELECT ${columnNames.includes('team_id') ? 'team_id' : 'group_id'} FROM team_members WHERE user_id = auth.uid()))`,
                            withCheck: `(${columnNames.includes('team_id') ? 'team_id' : 'group_id'} IN (SELECT ${columnNames.includes('team_id') ? 'team_id' : 'group_id'} FROM team_members WHERE user_id = auth.uid()))`,
                            description: 'Team-based access control'
                        });
                    }
                    
                    // Default suggestion if no patterns matched
                    if (suggestedPolicies.length === 0) {
                        suggestedPolicies.push({
                            type: 'authenticated_only',
                            name: `${table.tablename}_authenticated`,
                            command: 'ALL',
                            using: `(auth.role() = 'authenticated')`,
                            withCheck: `(auth.role() = 'authenticated')`,
                            description: 'Authenticated users only'
                        });
                    }
                    
                    suggestions.push({
                        table: `${table.schemaname}.${table.tablename}`,
                        currentStatus: {
                            rlsEnabled: table.rls_enabled,
                            forceRls: table.force_rls,
                            policyCount: table.policy_count
                        },
                        columns: columnNames,
                        suggestedPolicies
                    });
                }
            }
        }
        
        // Check for orphaned policies (policies on non-existent tables)
        let orphanedPolicies: any[] = [];
        if (validatedInput.checkOrphans) {
            const orphansSql = `
                SELECT DISTINCT 
                    schemaname || '.' || tablename AS table_reference
                FROM pg_policies
                WHERE NOT EXISTS (
                    SELECT 1 FROM pg_tables t 
                    WHERE t.schemaname = pg_policies.schemaname 
                    AND t.tablename = pg_policies.tablename
                )
            `;
            
            const orphans = await executeSqlWithFallback(orphansSql, context);
            orphanedPolicies = orphans.data;
        }
        
        // Generate security score
        const totalTables = tables.data.length;
        const tablesWithRls = tables.data.filter((t: any) => t.rls_enabled).length;
        const tablesWithPolicies = tables.data.filter((t: any) => t.policy_count > 0).length;
        const tablesWithForceRls = tables.data.filter((t: any) => t.force_rls).length;
        
        const securityScore = totalTables > 0 
            ? Math.round((tablesWithPolicies / totalTables) * 100)
            : 100;
        
        // Identify critical issues
        const criticalIssues = [];
        
        const unprotectedTables = tables.data.filter((t: any) => !t.rls_enabled);
        if (unprotectedTables.length > 0) {
            criticalIssues.push({
                severity: 'HIGH',
                issue: 'Tables without RLS',
                affected: unprotectedTables.map((t: any) => `${t.schemaname}.${t.tablename}`),
                recommendation: 'Enable RLS on these tables immediately'
            });
        }
        
        const rlsWithoutPolicies = tables.data.filter((t: any) => t.rls_enabled && t.policy_count === 0);
        if (rlsWithoutPolicies.length > 0) {
            criticalIssues.push({
                severity: 'MEDIUM',
                issue: 'RLS enabled but no policies defined',
                affected: rlsWithoutPolicies.map((t: any) => `${t.schemaname}.${t.tablename}`),
                recommendation: 'These tables will deny all access. Add appropriate policies.'
            });
        }
        
        const withoutForceRls = tables.data.filter((t: any) => t.rls_enabled && !t.force_rls);
        if (withoutForceRls.length > 0) {
            criticalIssues.push({
                severity: 'LOW',
                issue: 'RLS not forced',
                affected: withoutForceRls.map((t: any) => `${t.schemaname}.${t.tablename}`),
                recommendation: 'Consider forcing RLS to ensure it applies to table owners'
            });
        }
        
        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    securityScore,
                    summary: {
                        totalTables,
                        tablesWithRls,
                        tablesWithPolicies,
                        tablesWithForceRls,
                        unprotectedTables: totalTables - tablesWithRls,
                        orphanedPolicies: orphanedPolicies.length
                    },
                    criticalIssues,
                    tableDetails: tables.data.map((t: any) => ({
                        table: `${t.schemaname}.${t.tablename}`,
                        rlsEnabled: t.rls_enabled,
                        forceRls: t.force_rls,
                        policyCount: t.policy_count,
                        status: t.rls_enabled 
                            ? (t.policy_count > 0 ? '✅ Protected' : '⚠️ RLS without policies')
                            : '❌ Unprotected'
                    })),
                    suggestions: validatedInput.suggestPolicies ? suggestions : undefined,
                    orphanedPolicies: validatedInput.checkOrphans ? orphanedPolicies : undefined,
                    recommendations: {
                        immediate: criticalIssues.filter(i => i.severity === 'HIGH'),
                        important: criticalIssues.filter(i => i.severity === 'MEDIUM'),
                        suggested: criticalIssues.filter(i => i.severity === 'LOW')
                    }
                }, null, 2)
            }]
        };
    }
};