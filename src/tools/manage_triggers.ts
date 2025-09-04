import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const ManageTriggersInputSchema = z.object({
    action: z.enum(['create', 'delete', 'list', 'enable', 'disable', 'create_audit', 'create_updated_at']).describe("Action to perform"),
    triggerName: z.string().optional().describe("Trigger name"),
    tableName: z.string().optional().describe("Table name"),
    timing: z.enum(['BEFORE', 'AFTER', 'INSTEAD OF']).optional().default('AFTER'),
    events: z.array(z.enum(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'])).optional().default(['INSERT', 'UPDATE', 'DELETE']),
    functionName: z.string().optional().describe("Function to execute"),
    whenCondition: z.string().optional().describe("WHEN condition for trigger"),
    forEach: z.enum(['ROW', 'STATEMENT']).optional().default('ROW')
});

type ManageTriggersInput = z.infer<typeof ManageTriggersInputSchema>;

export const manageTriggersTool: Tool = {
    name: "manage_triggers",
    description: "Create, manage, and monitor database triggers including audit and timestamp triggers",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["create", "delete", "list", "enable", "disable", "create_audit", "create_updated_at"],
                description: "Action to perform"
            },
            triggerName: { type: "string" },
    mcpInputSchema: {
        type: "object",
        properties: {},
        required: []
    },
    outputSchema: z.object({
        content: z.array(z.object({
            type: z.literal("text"),
            text: z.string()
        }))
    }),
            tableName: { type: "string" },
            timing: {
                type: "string",
                enum: ["BEFORE", "AFTER", "INSTEAD OF"]
            },
            events: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]
                }
            },
            functionName: { type: "string" },
            whenCondition: { type: "string" },
            forEach: {
                type: "string",
                enum: ["ROW", "STATEMENT"]
            }
        },
        required: ["action"]
    },
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ManageTriggersInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'list': {
                const sql = `
                    SELECT 
                        t.tgname AS trigger_name,
                        ns.nspname || '.' || c.relname AS table_name,
                        p.proname AS function_name,
                        t.tgenabled AS enabled,
                        CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
                        CASE t.tgtype & 28
                            WHEN 4 THEN 'INSERT'
                            WHEN 8 THEN 'DELETE'
                            WHEN 16 THEN 'UPDATE'
                            WHEN 20 THEN 'INSERT,UPDATE'
                            WHEN 24 THEN 'UPDATE,DELETE'
                            WHEN 12 THEN 'INSERT,DELETE'
                            WHEN 28 THEN 'INSERT,UPDATE,DELETE'
                        END AS events,
                        CASE t.tgtype & 1 WHEN 1 THEN 'ROW' ELSE 'STATEMENT' END AS for_each,
                        obj_description(t.oid, 'pg_trigger') AS description
                    FROM pg_trigger t
                    JOIN pg_class c ON t.tgrelid = c.oid
                    JOIN pg_namespace ns ON c.relnamespace = ns.oid
                    JOIN pg_proc p ON t.tgfoid = p.oid
                    WHERE NOT t.tgisinternal
                    ${validatedInput.tableName ? `AND ns.nspname || '.' || c.relname = '${validatedInput.tableName}'` : ''}
                    ORDER BY ns.nspname, c.relname, t.tgname
                `;
                
                const result = await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            triggers: result.data,
                            count: result.data.length
                        }, null, 2)
                    }]
                };
            }
            
            case 'create_updated_at': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required");
                }
                
                // First create the function if it doesn't exist
                const funcSql = `
                    CREATE OR REPLACE FUNCTION update_updated_at_column()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        NEW.updated_at = NOW();
                        RETURN NEW;
                    END;
                    $$ language 'plpgsql';
                `;
                await executeSqlWithFallback(funcSql, context);
                
                // Create the trigger
                const triggerName = validatedInput.triggerName || `update_${validatedInput.tableName.replace('.', '_')}_updated_at`;
                const sql = `
                    CREATE TRIGGER ${triggerName}
                    BEFORE UPDATE ON ${validatedInput.tableName}
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column();
                `;
                
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Updated_at trigger created successfully",
                            trigger: triggerName,
                            table: validatedInput.tableName
                        }, null, 2)
                    }]
                };
            }
            
            case 'create_audit': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required");
                }
                
                // Create audit table if it doesn't exist
                const auditTableSql = `
                    CREATE TABLE IF NOT EXISTS audit.audit_log (
                        id BIGSERIAL PRIMARY KEY,
                        table_name TEXT NOT NULL,
                        operation TEXT NOT NULL,
                        user_id UUID,
                        changed_at TIMESTAMPTZ DEFAULT NOW(),
                        old_data JSONB,
                        new_data JSONB,
                        query TEXT,
                        ip_address INET
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit.audit_log(table_name);
                    CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit.audit_log(changed_at);
                    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit.audit_log(user_id);
                `;
                
                try {
                    await executeSqlWithFallback('CREATE SCHEMA IF NOT EXISTS audit', context);
                    await executeSqlWithFallback(auditTableSql, context);
                } catch (error) {
                    // Schema or table might already exist
                }
                
                // Create audit function
                const funcName = `audit_${validatedInput.tableName.replace('.', '_')}_changes`;
                const funcSql = `
                    CREATE OR REPLACE FUNCTION ${funcName}()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        INSERT INTO audit.audit_log (
                            table_name,
                            operation,
                            user_id,
                            old_data,
                            new_data,
                            query,
                            ip_address
                        ) VALUES (
                            TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
                            TG_OP,
                            auth.uid(),
                            CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
                            CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
                            current_query(),
                            inet_client_addr()
                        );
                        RETURN COALESCE(NEW, OLD);
                    END;
                    $$ LANGUAGE plpgsql SECURITY DEFINER;
                `;
                await executeSqlWithFallback(funcSql, context);
                
                // Create trigger
                const triggerName = validatedInput.triggerName || `audit_${validatedInput.tableName.replace('.', '_')}`;
                const sql = `
                    CREATE TRIGGER ${triggerName}
                    AFTER INSERT OR UPDATE OR DELETE ON ${validatedInput.tableName}
                    FOR EACH ROW
                    EXECUTE FUNCTION ${funcName}();
                `;
                
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Audit trigger created successfully",
                            trigger: triggerName,
                            table: validatedInput.tableName,
                            auditTable: 'audit.audit_log'
                        }, null, 2)
                    }]
                };
            }
            
            case 'create': {
                if (!validatedInput.triggerName || !validatedInput.tableName || !validatedInput.functionName) {
                    throw new Error("Trigger name, table name, and function name are required");
                }
                
                const events = validatedInput.events.join(' OR ');
                let sql = `
                    CREATE TRIGGER ${validatedInput.triggerName}
                    ${validatedInput.timing} ${events} ON ${validatedInput.tableName}
                    FOR EACH ${validatedInput.forEach}
                `;
                
                if (validatedInput.whenCondition) {
                    sql += ` WHEN (${validatedInput.whenCondition})`;
                }
                
                sql += ` EXECUTE FUNCTION ${validatedInput.functionName}();`;
                
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Trigger created successfully",
                            trigger: validatedInput.triggerName,
                            table: validatedInput.tableName,
                            function: validatedInput.functionName
                        }, null, 2)
                    }]
                };
            }
            
            case 'delete': {
                if (!validatedInput.triggerName || !validatedInput.tableName) {
                    throw new Error("Trigger name and table name are required");
                }
                
                const sql = `DROP TRIGGER IF EXISTS ${validatedInput.triggerName} ON ${validatedInput.tableName}`;
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Trigger deleted successfully",
                            trigger: validatedInput.triggerName,
                            table: validatedInput.tableName
                        }, null, 2)
                    }]
                };
            }
            
            case 'enable': {
                if (!validatedInput.triggerName || !validatedInput.tableName) {
                    throw new Error("Trigger name and table name are required");
                }
                
                const sql = `ALTER TABLE ${validatedInput.tableName} ENABLE TRIGGER ${validatedInput.triggerName}`;
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Trigger enabled",
                            trigger: validatedInput.triggerName,
                            table: validatedInput.tableName
                        }, null, 2)
                    }]
                };
            }
            
            case 'disable': {
                if (!validatedInput.triggerName || !validatedInput.tableName) {
                    throw new Error("Trigger name and table name are required");
                }
                
                const sql = `ALTER TABLE ${validatedInput.tableName} DISABLE TRIGGER ${validatedInput.triggerName}`;
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Trigger disabled",
                            trigger: validatedInput.triggerName,
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