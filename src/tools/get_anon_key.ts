import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Input schema (none needed)
const GetAnonKeyInputSchema = z.object({});
type GetAnonKeyInput = z.infer<typeof GetAnonKeyInputSchema>;

// Output schema
const GetAnonKeyOutputSchema = z.object({
    anon_key: z.string(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const getAnonKeyTool = {
    name: 'get_anon_key',
    description: 'Returns the configured Supabase anon key for this server.',
    inputSchema: GetAnonKeyInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: GetAnonKeyOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;
        const key = client.getAnonKey(); // Use getter from client
        return { anon_key: key };
    },
}; 