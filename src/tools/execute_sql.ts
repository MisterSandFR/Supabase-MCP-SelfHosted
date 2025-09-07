import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
// import type { McpToolDefinition } from '@modelcontextprotocol/sdk'; // Removed incorrect import
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { validateSqlQuery } from '../utils/sql-sanitizer.js';

// Input schema
const ExecuteSqlInputSchema = z.object({
    sql: z.string().describe('The SQL query to execute.'),
    read_only: z.boolean().optional().default(false).describe('Hint for the RPC function whether the query is read-only (best effort).'),
    allow_multiple_statements: z.boolean().optional().default(false).describe('Allow multiple SQL statements separated by semicolons (DDL operations, migrations).'),
    // Future enhancement: Add option to force direct connection?
    // use_direct_connection: z.boolean().optional().default(false).describe('Attempt to use direct DB connection instead of RPC.'),
});
type ExecuteSqlInput = z.infer<typeof ExecuteSqlInputSchema>;

// Output schema - expects an array of results (rows)
const ExecuteSqlOutputSchema = z.array(z.unknown()).describe('The array of rows returned by the SQL query.');

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        sql: { type: 'string', description: 'The SQL query to execute.' },
        read_only: { type: 'boolean', default: false, description: 'Hint for the RPC function whether the query is read-only (best effort).' },
        allow_multiple_statements: { type: 'boolean', default: false, description: 'Allow multiple SQL statements separated by semicolons (DDL operations, migrations).' },
    },
    required: ['sql'],
};

// The tool definition - No explicit McpToolDefinition type needed
export const executeSqlTool = {
    name: 'execute_sql',
    description: 'Executes an arbitrary SQL query against the database, using direct database connection when available or RPC function as fallback. Supports multi-statement DDL operations for migrations and complex schema changes.',
    inputSchema: ExecuteSqlInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ExecuteSqlOutputSchema,
    execute: async (input: ExecuteSqlInput, context: ToolContext) => {
        const client = context.selfhostedClient;

        // Validate SQL query for injection attempts
        try {
            validateSqlQuery(input.sql, input.allow_multiple_statements);
        } catch (error) {
            throw new Error(`SQL validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.error(`Executing SQL (readOnly: ${input.read_only}, multiStatement: ${input.allow_multiple_statements}): ${input.sql.substring(0, 100)}...`);
        
        // For multi-statement queries, force direct connection if available
        if (input.allow_multiple_statements && !input.read_only) {
            if (!client.isPgAvailable()) {
                throw new Error('Multi-statement DDL operations require direct database connection (DATABASE_URL) but it is not configured or available.');
            }
            console.info('Using direct database connection for multi-statement DDL...');
            const result = await client.executeSqlWithPg(input.sql);
            return handleSqlResponse(result, ExecuteSqlOutputSchema);
        }
        
        const result = await executeSqlWithFallback(client, input.sql, input.read_only);
        return handleSqlResponse(result, ExecuteSqlOutputSchema);
    },
}; 