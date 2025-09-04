import { Tool } from "@modelcontextprotocol/sdk/dist/types.js";
import { z } from "zod";
import { ToolContext } from "./types.js";
import { executeSqlWithFallback } from "./utils.js";

const ManageFunctionsInputSchema = z.object({
    action: z.enum(['create', 'update', 'delete', 'list', 'execute', 'generate_crud']).describe("Action to perform"),
    functionName: z.string().optional().describe("Function name"),
    schema: z.string().optional().default('public').describe("Schema name"),
    parameters: z.array(z.object({
        name: z.string(),
        type: z.string(),
        default: z.string().optional()
    })).optional().describe("Function parameters"),
    returnType: z.string().optional().default('void').describe("Return type"),
    body: z.string().optional().describe("Function body (SQL or plpgsql)"),
    language: z.enum(['sql', 'plpgsql', 'plv8', 'plpython3u']).optional().default('plpgsql'),
    security: z.enum(['DEFINER', 'INVOKER']).optional().default('INVOKER'),
    volatility: z.enum(['IMMUTABLE', 'STABLE', 'VOLATILE']).optional().default('VOLATILE'),
    executeParams: z.record(z.any()).optional().describe("Parameters for function execution"),
    tableName: z.string().optional().describe("Table name for CRUD generation")
});

type ManageFunctionsInput = z.infer<typeof ManageFunctionsInputSchema>;

const ManageFunctionsOutputSchema = z.object({
    content: z.array(z.object({
        type: z.literal("text"),
        text: z.string()
    }))
});

export const manageFunctionsTool = {
    name: "manage_functions",
    description: "Create, update, delete, and manage PostgreSQL functions including stored procedures",
    inputSchema: ManageFunctionsInputSchema,
    mcpInputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["create", "update", "delete", "list", "execute", "generate_crud"],
                description: "Action to perform"
            },
            functionName: { type: "string", description: "Function name" },
            schema: { type: "string", description: "Schema name" },
            parameters: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        type: { type: "string" },
                        default: { type: "string" }
                    },
                    required: ["name", "type"]
                },
                description: "Function parameters"
            },
            returnType: { type: "string", description: "Return type" },
            body: { type: "string", description: "Function body" },
            language: {
                type: "string",
                enum: ["sql", "plpgsql", "plv8", "plpython3u"],
                description: "Function language"
            },
            security: {
                type: "string",
                enum: ["DEFINER", "INVOKER"],
                description: "Security type"
            },
            volatility: {
                type: "string",
                enum: ["IMMUTABLE", "STABLE", "VOLATILE"],
                description: "Volatility"
            },
            executeParams: {
                type: "object",
                description: "Parameters for execution"
            },
            tableName: { type: "string", description: "Table for CRUD generation" }
        },
        required: ["action"]
    },
    outputSchema: ManageFunctionsOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const validatedInput = ManageFunctionsInputSchema.parse(input);
        
        switch (validatedInput.action) {
            case 'list': {
                const sql = `
                    SELECT 
                        n.nspname AS schema_name,
                        p.proname AS function_name,
                        pg_catalog.pg_get_function_arguments(p.oid) AS arguments,
                        pg_catalog.pg_get_function_result(p.oid) AS return_type,
                        l.lanname AS language,
                        p.prosecdef AS security_definer,
                        CASE p.provolatile
                            WHEN 'i' THEN 'IMMUTABLE'
                            WHEN 's' THEN 'STABLE'
                            WHEN 'v' THEN 'VOLATILE'
                        END AS volatility,
                        obj_description(p.oid, 'pg_proc') AS description
                    FROM pg_catalog.pg_proc p
                    LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
                    LEFT JOIN pg_catalog.pg_language l ON l.oid = p.prolang
                    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                    ${validatedInput.schema ? `AND n.nspname = '${validatedInput.schema}'` : ''}
                    ${validatedInput.functionName ? `AND p.proname LIKE '%${validatedInput.functionName}%'` : ''}
                    ORDER BY n.nspname, p.proname
                `;
                
                const result = await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            functions: result.data,
                            count: result.data.length
                        }, null, 2)
                    }]
                };
            }
            
            case 'create': {
                if (!validatedInput.functionName || !validatedInput.body) {
                    throw new Error("Function name and body are required");
                }
                
                const params = validatedInput.parameters?.map(p => 
                    `${p.name} ${p.type}${p.default ? ` DEFAULT ${p.default}` : ''}`
                ).join(', ') || '';
                
                const sql = `
                    CREATE OR REPLACE FUNCTION ${validatedInput.schema}.${validatedInput.functionName}(${params})
                    RETURNS ${validatedInput.returnType}
                    LANGUAGE ${validatedInput.language}
                    SECURITY ${validatedInput.security}
                    ${validatedInput.volatility}
                    AS $$
                    ${validatedInput.body}
                    $$;
                `;
                
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Function created successfully",
                            function: `${validatedInput.schema}.${validatedInput.functionName}`,
                            signature: `${validatedInput.functionName}(${params})`
                        }, null, 2)
                    }]
                };
            }
            
            case 'generate_crud': {
                if (!validatedInput.tableName) {
                    throw new Error("Table name is required for CRUD generation");
                }
                
                // Get table columns
                const columnsSql = `
                    SELECT 
                        column_name,
                        data_type,
                        is_nullable,
                        column_default
                    FROM information_schema.columns
                    WHERE table_schema = $1 AND table_name = $2
                    ORDER BY ordinal_position
                `;
                
                const [schemaName, tableName] = validatedInput.tableName.includes('.') 
                    ? validatedInput.tableName.split('.')
                    : ['public', validatedInput.tableName];
                
                const columns = await executeSqlWithFallback(
                    columnsSql,
                    context,
                    [schemaName, tableName]
                );
                
                const primaryKey = columns.data.find((c: any) => 
                    c.column_default?.includes('nextval') || c.column_name === 'id'
                )?.column_name || 'id';
                
                const crudFunctions = [];
                
                // CREATE function
                const createFunc = `
                    CREATE OR REPLACE FUNCTION ${schemaName}.create_${tableName}(data jsonb)
                    RETURNS ${schemaName}.${tableName}
                    LANGUAGE plpgsql
                    SECURITY INVOKER
                    AS $$
                    DECLARE
                        result ${schemaName}.${tableName};
                    BEGIN
                        INSERT INTO ${schemaName}.${tableName}
                        SELECT * FROM jsonb_populate_record(NULL::${schemaName}.${tableName}, data)
                        RETURNING * INTO result;
                        RETURN result;
                    END;
                    $$;
                `;
                await executeSqlWithFallback(createFunc, context);
                crudFunctions.push(`create_${tableName}`);
                
                // READ function
                const readFunc = `
                    CREATE OR REPLACE FUNCTION ${schemaName}.get_${tableName}(${primaryKey}_param ${columns.data.find((c: any) => c.column_name === primaryKey)?.data_type || 'bigint'})
                    RETURNS ${schemaName}.${tableName}
                    LANGUAGE plpgsql
                    SECURITY INVOKER
                    AS $$
                    BEGIN
                        RETURN (SELECT * FROM ${schemaName}.${tableName} WHERE ${primaryKey} = ${primaryKey}_param);
                    END;
                    $$;
                `;
                await executeSqlWithFallback(readFunc, context);
                crudFunctions.push(`get_${tableName}`);
                
                // UPDATE function
                const updateFunc = `
                    CREATE OR REPLACE FUNCTION ${schemaName}.update_${tableName}(${primaryKey}_param ${columns.data.find((c: any) => c.column_name === primaryKey)?.data_type || 'bigint'}, data jsonb)
                    RETURNS ${schemaName}.${tableName}
                    LANGUAGE plpgsql
                    SECURITY INVOKER
                    AS $$
                    DECLARE
                        result ${schemaName}.${tableName};
                    BEGIN
                        UPDATE ${schemaName}.${tableName}
                        SET ${columns.data
                            .filter((c: any) => c.column_name !== primaryKey)
                            .map((c: any) => `${c.column_name} = COALESCE((data->>'${c.column_name}')::${c.data_type}, ${c.column_name})`)
                            .join(',\n            ')}
                        WHERE ${primaryKey} = ${primaryKey}_param
                        RETURNING * INTO result;
                        RETURN result;
                    END;
                    $$;
                `;
                await executeSqlWithFallback(updateFunc, context);
                crudFunctions.push(`update_${tableName}`);
                
                // DELETE function
                const deleteFunc = `
                    CREATE OR REPLACE FUNCTION ${schemaName}.delete_${tableName}(${primaryKey}_param ${columns.data.find((c: any) => c.column_name === primaryKey)?.data_type || 'bigint'})
                    RETURNS boolean
                    LANGUAGE plpgsql
                    SECURITY INVOKER
                    AS $$
                    BEGIN
                        DELETE FROM ${schemaName}.${tableName} WHERE ${primaryKey} = ${primaryKey}_param;
                        RETURN FOUND;
                    END;
                    $$;
                `;
                await executeSqlWithFallback(deleteFunc, context);
                crudFunctions.push(`delete_${tableName}`);
                
                // LIST function with pagination
                const listFunc = `
                    CREATE OR REPLACE FUNCTION ${schemaName}.list_${tableName}(
                        limit_param integer DEFAULT 10,
                        offset_param integer DEFAULT 0,
                        order_by text DEFAULT '${primaryKey}',
                        order_dir text DEFAULT 'DESC'
                    )
                    RETURNS TABLE(data jsonb, total_count bigint)
                    LANGUAGE plpgsql
                    SECURITY INVOKER
                    AS $$
                    DECLARE
                        total bigint;
                    BEGIN
                        SELECT COUNT(*) INTO total FROM ${schemaName}.${tableName};
                        
                        RETURN QUERY
                        SELECT 
                            jsonb_agg(t.*) AS data,
                            total AS total_count
                        FROM (
                            SELECT * FROM ${schemaName}.${tableName}
                            ORDER BY 
                                CASE WHEN order_dir = 'ASC' THEN ${primaryKey} END ASC,
                                CASE WHEN order_dir = 'DESC' THEN ${primaryKey} END DESC
                            LIMIT limit_param
                            OFFSET offset_param
                        ) t;
                    END;
                    $$;
                `;
                await executeSqlWithFallback(listFunc, context);
                crudFunctions.push(`list_${tableName}`);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "CRUD functions generated successfully",
                            table: `${schemaName}.${tableName}`,
                            functions: crudFunctions,
                            usage: {
                                create: `SELECT * FROM ${schemaName}.create_${tableName}('{"field": "value"}'::jsonb)`,
                                read: `SELECT * FROM ${schemaName}.get_${tableName}(1)`,
                                update: `SELECT * FROM ${schemaName}.update_${tableName}(1, '{"field": "new_value"}'::jsonb)`,
                                delete: `SELECT * FROM ${schemaName}.delete_${tableName}(1)`,
                                list: `SELECT * FROM ${schemaName}.list_${tableName}(10, 0, '${primaryKey}', 'DESC')`
                            }
                        }, null, 2)
                    }]
                };
            }
            
            case 'execute': {
                if (!validatedInput.functionName) {
                    throw new Error("Function name is required for execution");
                }
                
                const params = validatedInput.executeParams 
                    ? Object.values(validatedInput.executeParams).map((v, i) => `$${i + 1}`).join(', ')
                    : '';
                
                const sql = `SELECT * FROM ${validatedInput.schema}.${validatedInput.functionName}(${params})`;
                
                const result = await executeSqlWithFallback(
                    sql,
                    context,
                    validatedInput.executeParams ? Object.values(validatedInput.executeParams) : undefined
                );
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            function: `${validatedInput.schema}.${validatedInput.functionName}`,
                            result: result.data,
                            rowCount: result.data.length
                        }, null, 2)
                    }]
                };
            }
            
            case 'delete': {
                if (!validatedInput.functionName) {
                    throw new Error("Function name is required for deletion");
                }
                
                const sql = `DROP FUNCTION IF EXISTS ${validatedInput.schema}.${validatedInput.functionName} CASCADE`;
                await executeSqlWithFallback(sql, context);
                
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            message: "Function deleted successfully",
                            function: `${validatedInput.schema}.${validatedInput.functionName}`
                        }, null, 2)
                    }]
                };
            }
            
            default:
                throw new Error(`Unknown action: ${validatedInput.action}`);
        }
    }
};