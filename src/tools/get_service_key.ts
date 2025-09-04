import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Input schema (none needed)
const GetServiceKeyInputSchema = z.object({});
type GetServiceKeyInput = z.infer<typeof GetServiceKeyInputSchema>;

// Output schema
const GetServiceKeyOutputSchema = z.object({
    service_key_status: z.enum(['found', 'not_configured']).describe('Whether the service key was provided to the server.'),
    service_key: z.string().optional().describe('The configured Supabase service role key (if configured).'),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const getServiceKeyTool = {
    name: 'get_service_key',
    description: 'Returns the configured Supabase service role key for this server, if available.',
    inputSchema: GetServiceKeyInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: GetServiceKeyOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;
        const key = client.getServiceRoleKey();
        if (key) {
            return { service_key_status: 'found', service_key: key };
        }
        return { service_key_status: 'not_configured' };
    },
}; 