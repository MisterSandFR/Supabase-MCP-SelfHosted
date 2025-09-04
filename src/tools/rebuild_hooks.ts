import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import type { SelfhostedSupabaseClient } from '../client/index.js';
// import type { McpToolDefinition } from '@modelcontextprotocol/sdk'; // Removed incorrect import
import { handleSqlResponse, executeSqlWithFallback } from './utils.js';
import type { ToolContext } from './types.js';

// Input schema (none needed)
const RebuildHooksInputSchema = z.object({});
type RebuildHooksInput = z.infer<typeof RebuildHooksInputSchema>;

// Output schema
const RebuildHooksOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition - No explicit McpToolDefinition type needed
export const rebuildHooksTool: Tool = {
    name: 'rebuild_hooks',
    description: 'Attempts to restart the pg_net worker. Requires the pg_net extension to be installed and available.',
    inputSchema: RebuildHooksInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: RebuildHooksOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;

        // Attempt to restart the pg_net worker.
        // This might fail if pg_net is not installed or the user lacks permissions.
        const restartSql = 'SELECT net.worker_restart()'; // Remove semicolon

        try {
            console.error('Attempting to restart pg_net worker...');
            const result = await executeSqlWithFallback(client, restartSql, false);

            // Check if the result contains an error
            if ('error' in result) {
                // Specific check for function not found (pg_net might not be installed/active)
                const notFound = result.error.code === '42883'; // undefined_function
                const message = `Failed to restart pg_net worker: ${result.error.message}${notFound ? ' (Is pg_net installed and enabled?)' : ''}`;
                console.error(message);
                return { success: false, message };
            }

            // If no error, assume success
            console.error('pg_net worker restart requested successfully.');
            return { success: true, message: 'pg_net worker restart requested successfully.' };

        } catch (error: unknown) {
            // Catch exceptions during the RPC call itself
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Exception attempting to restart pg_net worker: ${errorMessage}`);
            return { success: false, message: `Exception attempting to restart pg_net worker: ${errorMessage}` };
        }
    },
}; 