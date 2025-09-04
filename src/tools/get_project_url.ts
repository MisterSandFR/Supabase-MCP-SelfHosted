import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Input schema (none needed)
const GetProjectUrlInputSchema = z.object({});
type GetProjectUrlInput = z.infer<typeof GetProjectUrlInputSchema>;

// Output schema
const GetProjectUrlOutputSchema = z.object({
    project_url: z.string().url(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const getProjectUrlTool = {
    name: 'get_project_url',
    description: 'Returns the configured Supabase project URL for this server.',
    inputSchema: GetProjectUrlInputSchema,
    mcpInputSchema: mcpInputSchema, // Add static JSON schema
    outputSchema: GetProjectUrlOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;
        const url = client.getSupabaseUrl(); // Use getter from client
        return { project_url: url };
    },
}; 