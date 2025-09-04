import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Schema for the output: array of extension details
const ListExtensionsOutputSchema = z.array(z.object({
    name: z.string(),
    schema: z.string(),
    version: z.string(),
    description: z.string().nullable().optional(),
}));

// Input schema (none needed for this tool)
const ListExtensionsInputSchema = z.object({});
type ListExtensionsInput = z.infer<typeof ListExtensionsInputSchema>;
// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object', 
    properties: {},
    required: [],
};

// The tool definition
export const listExtensionsTool = {
    name: 'list_extensions',
    description: 'Lists all installed PostgreSQL extensions in the database.',
    inputSchema: ListExtensionsInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ListExtensionsOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;

        // SQL based on pg_extension
        const listExtensionsSql = `
            SELECT
                pe.extname AS name,
                pn.nspname AS schema,
                pe.extversion AS version,
                pd.description
            FROM
                pg_catalog.pg_extension pe
            LEFT JOIN
                pg_catalog.pg_namespace pn ON pn.oid = pe.extnamespace
            LEFT JOIN
                pg_catalog.pg_description pd ON pd.objoid = pe.oid AND pd.classoid = 'pg_catalog.pg_extension'::regclass
            WHERE
                pe.extname != 'plpgsql' -- Exclude the default plpgsql extension
            ORDER BY
                pe.extname
        `;

        const result = await executeSqlWithFallback(client, listExtensionsSql, true);

        return handleSqlResponse(result, ListExtensionsOutputSchema);
    },
}; 