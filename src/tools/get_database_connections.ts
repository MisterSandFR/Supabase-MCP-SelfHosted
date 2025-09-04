import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Schema for the output: array of connection details
const GetDbConnectionsOutputSchema = z.array(z.object({
    datname: z.string().nullable().describe('Database name'),
    usename: z.string().nullable().describe('User name'),
    application_name: z.string().nullable().describe('Application name (e.g., PostgREST, psql)'),
    client_addr: z.string().nullable().describe('Client IP address'),
    backend_start: z.string().nullable().describe('Time when the backend process started'),
    state: z.string().nullable().describe('Current connection state (e.g., active, idle)'),
    query: z.string().nullable().describe('Last or current query being executed'),
    pid: z.number().describe('Process ID of the backend'),
}));

// Input schema (allow filtering by user or database later if needed)
const GetDbConnectionsInputSchema = z.object({});
type GetDbConnectionsInput = z.infer<typeof GetDbConnectionsInputSchema>;

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const getDatabaseConnectionsTool = {
    name: 'get_database_connections',
    description: 'Retrieves information about active database connections from pg_stat_activity.',
    inputSchema: GetDbConnectionsInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: GetDbConnectionsOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;

        // Query pg_stat_activity
        // Note: Access to pg_stat_activity might require superuser or specific grants.
        const getConnectionsSql = `
            SELECT
                pid,
                datname,
                usename,
                application_name,
                client_addr::text, -- Cast inet to text
                backend_start::text, -- Cast timestamp to text
                state,
                query
            FROM
                pg_stat_activity
            WHERE
                backend_type = 'client backend' -- Exclude background workers, etc.
                -- Optionally filter out self?
                -- AND pid != pg_backend_pid()
            ORDER BY
                backend_start
        `;

        const result = await executeSqlWithFallback(client, getConnectionsSql, true);

        return handleSqlResponse(result, GetDbConnectionsOutputSchema);
    },
}; 