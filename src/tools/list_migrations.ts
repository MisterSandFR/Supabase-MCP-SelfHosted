import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';

// Schema for the output: array of migration details
const ListMigrationsOutputSchema = z.array(z.object({
    version: z.string(),
    name: z.string(),
    inserted_at: z.string(), // Keep as string from DB
}));

// Input schema (none needed for this tool)
const ListMigrationsInputSchema = z.object({});
type ListMigrationsInput = z.infer<typeof ListMigrationsInputSchema>;

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const listMigrationsTool = {
    name: 'list_migrations',
    description: 'Lists applied database migrations recorded in supabase_migrations.schema_migrations table.',
    inputSchema: ListMigrationsInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ListMigrationsOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;

        // SQL to query the Supabase migrations table
        const listMigrationsSql = `
            SELECT
                version,
                name,
                inserted_at
            FROM
                supabase_migrations.schema_migrations
            ORDER BY
                version
        `;

        // This table might not exist if migrations haven't been run
        // The RPC call will handle the error, which handleSqlResponse will catch
        const result = await executeSqlWithFallback(client, listMigrationsSql, true);

        return handleSqlResponse(result, ListMigrationsOutputSchema);
    },
}; 