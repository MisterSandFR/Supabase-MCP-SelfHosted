import { z } from "zod";
import { ToolContext } from "./types.js";
import type { SelfhostedSupabaseClient } from '../client/index.js';
import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Input schema (none needed)
const VerifyJwtInputSchema = z.object({});
type VerifyJwtInput = z.infer<typeof VerifyJwtInputSchema>;

// Output schema
const VerifyJwtOutputSchema = z.object({
    jwt_secret_status: z.enum(['found', 'not_configured']).describe('Whether the JWT secret was provided to the server.'),
    jwt_secret_preview: z.string().optional().describe('A preview of the JWT secret (first few characters) if configured.'),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {},
    required: [],
};

// The tool definition
export const verifyJwtSecretTool = {
    name: 'verify_jwt_secret',
    description: 'Checks if the Supabase JWT secret is configured for this server and returns a preview.',
    inputSchema: VerifyJwtInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: VerifyJwtOutputSchema,
    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;
        const secret = client.getJwtSecret();

        if (secret) {
            // Return only a preview for security
            const preview = `${secret.substring(0, Math.min(secret.length, 5))}...`;
            return {
                jwt_secret_status: 'found',
                jwt_secret_preview: preview,
            };
        }

        return { jwt_secret_status: 'not_configured' };
    },
}; 