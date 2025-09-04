import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleSqlResponse } from './utils.js';
import type { SqlSuccessResponse, AuthUser } from '../types/index.js';

// Input schema (initially no filters, add later)
const ListAuthUsersInputSchema = z.object({
    limit: z.number().int().positive().optional().default(50).describe('Max number of users to return'),
    offset: z.number().int().nonnegative().optional().default(0).describe('Number of users to skip'),
    // Add filters later (e.g., by email pattern, role)
});
type ListAuthUsersInput = z.infer<typeof ListAuthUsersInputSchema>;

// Output schema - Zod for validation
const AuthUserZodSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    role: z.string().nullable(),
    // Timestamps returned as text from DB might not strictly be ISO 8601 / Zod datetime compliant
    created_at: z.string().nullable(),
    last_sign_in_at: z.string().nullable(),
    raw_app_meta_data: z.record(z.unknown()).nullable(),
    raw_user_meta_data: z.record(z.unknown()).nullable(),
    // Add more fields as needed (e.g., email_confirmed_at, phone)
});
const ListAuthUsersOutputSchema = z.array(AuthUserZodSchema);
// Use AuthUser[] for the output type hint
type ListAuthUsersOutput = AuthUser[];

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        limit: {
            type: 'number',
            description: 'Max number of users to return',
            default: 50,
        },
        offset: {
            type: 'number',
            description: 'Number of users to skip',
            default: 0,
        },
    },
    required: [],
};

// Tool definition
export const listAuthUsersTool = {
    name: 'list_auth_users',
    description: 'Lists users from the auth.users table.',
    inputSchema: ListAuthUsersInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: ListAuthUsersOutputSchema,

    execute: async (input: unknown, context: ToolContext): Promise<ListAuthUsersOutput> => {
        const client = context.selfhostedClient;
        const { limit, offset } = input;

        // Check if direct DB connection is available, as it's likely needed for auth.users
        if (!client.isPgAvailable()) {
            context.log('Direct database connection (DATABASE_URL) is required to list auth users.', 'error');
            throw new Error('Direct database connection (DATABASE_URL) is required to list auth users.');
        }

        // Construct SQL query - ensure schema name is correct
        const listUsersSql = `
            SELECT
                id,
                email,
                role,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at::text, -- Cast timestamp to text for JSON
                last_sign_in_at::text -- Cast timestamp to text for JSON
            FROM
                auth.users
            ORDER BY
                created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
        `; // No semicolon needed here

        console.error('Attempting to list auth users using direct DB connection...');
        // Use direct connection (executeSqlWithPg) as it likely has necessary privileges
        const result = await client.executeSqlWithPg(listUsersSql);

        // Validate and return
        const validatedUsers = handleSqlResponse(result, ListAuthUsersOutputSchema);

        console.error(`Found ${validatedUsers.length} users.`);
        context.log(`Found ${validatedUsers.length} users.`);
        return validatedUsers;
    },
}; 