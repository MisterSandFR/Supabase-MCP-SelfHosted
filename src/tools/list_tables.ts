import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Define the schema for the tool's output (an array of table names)
const ListTablesOutputSchema = z.array(z.object({
    schema: z.string(),
    name: z.string(),
    comment: z.string().nullable().optional(), // Add comment if available
}));

// Define input type from schema
const ListTablesInputSchema = z.object({ // No specific input needed for listing tables
    // Optional: add schema filter later if needed
    // schema: z.string().optional().describe('Filter tables by schema name.'),
});
type ListTablesInput = z.infer<typeof ListTablesInputSchema>;

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object', 
    properties: {},
    required: [],
};

// Define the tool
export const listTablesTool = {
    name: 'list_tables',
    description: 'Lists all accessible tables in the connected database, grouped by schema.',
    inputSchema: ListTablesInputSchema, // Use defined schema
    mcpInputSchema: mcpInputSchema,     // Add the static JSON schema for MCP
    outputSchema: ListTablesOutputSchema,
    // Use explicit types for input and context
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;

        // SQL query to get tables from pg_catalog and information_schema
        // Excludes system schemas like pg_catalog, information_schema, and Supabase internal schemas
        const listTablesSql = `
            SELECT
                n.nspname as schema,
                c.relname as name,
                pgd.description as comment
            FROM
                pg_catalog.pg_class c
            JOIN
                pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN
                pg_catalog.pg_description pgd ON pgd.objoid = c.oid AND pgd.objsubid = 0
            WHERE
                c.relkind = 'r' -- r = ordinary table
                AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                AND n.nspname NOT LIKE 'pg_temp_%'
                AND n.nspname NOT LIKE 'pg_toast_temp_%'
                 -- Exclude Supabase internal schemas
                AND n.nspname NOT IN ('auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'pgbouncer', 'realtime', 'supabase_functions', 'supabase_migrations', '_realtime')
                AND has_schema_privilege(n.oid, 'USAGE')
                AND has_table_privilege(c.oid, 'SELECT')
            ORDER BY
                n.nspname,
                c.relname
        `;

        const result = await executeSqlWithFallback(client, listTablesSql, true);

        return handleSqlResponse(result, ListTablesOutputSchema); // Use a helper to handle response/errors
    },
}; 