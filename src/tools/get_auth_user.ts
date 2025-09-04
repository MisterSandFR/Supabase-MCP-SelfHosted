import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleSqlResponse } from './utils.js';
import type { PoolClient } from 'pg';
import type { SqlSuccessResponse, AuthUser } from '../types/index.js'; // Import AuthUser

// Input schema
const GetAuthUserInputSchema = z.object({
    user_id: z.string().uuid().describe('The UUID of the user to retrieve.'),
});
type GetAuthUserInput = z.infer<typeof GetAuthUserInputSchema>;

// Output schema - Zod for validation (single user)
const AuthUserZodSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    role: z.string().nullable(),
    created_at: z.string().nullable(),
    last_sign_in_at: z.string().nullable(),
    raw_app_meta_data: z.record(z.unknown()).nullable(),
    raw_user_meta_data: z.record(z.unknown()).nullable(),
    // Add more fields as needed
});
// Use AuthUser for the output type hint
type GetAuthUserOutput = AuthUser;

// Static JSON Schema for MCP
const mcpInputSchema = {
    type: 'object',
    properties: {
        user_id: {
            type: 'string',
            description: 'The UUID of the user to retrieve.',
            format: 'uuid', // Hint format if possible
        },
    },
    required: ['user_id'],
};

// Tool definition
export const getAuthUserTool = {
    name: 'get_auth_user',
    description: 'Retrieves details for a specific user from auth.users by their ID.',
    inputSchema: GetAuthUserInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: AuthUserZodSchema, // Use the single user Zod schema

    execute: async (input: unknown, context: ToolContext): Promise<GetAuthUserOutput> => { // Use GetAuthUserOutput
        const client = context.selfhostedClient;
        const { user_id } = input;

        if (!client.isPgAvailable()) {
            context.log('Direct database connection (DATABASE_URL) is required to get auth user details.', 'error');
            throw new Error('Direct database connection (DATABASE_URL) is required to get auth user details.');
        }

        const sql = `
            SELECT
                id,
                email,
                role,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at::text,
                last_sign_in_at::text
            FROM auth.users
            WHERE id = $1
        `;
        const params = [user_id];

        console.error(`Attempting to get auth user ${user_id} using direct DB connection...`);

        // Use transaction for parameterized query
        const user = await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
            const result = await pgClient.query(sql, params);

            if (result.rows.length === 0) {
                throw new Error(`User with ID ${user_id} not found.`);
            }

            // handleSqlResponse expects SqlExecutionResult (SuccessResponse | ErrorResponse)
            // We pass the single row which structurally matches SqlSuccessResponse[0]
            // but handleSqlResponse expects the array wrapper or error.
            // So, we validate the single object directly.
            try {
                const singleUser = AuthUserZodSchema.parse(result.rows[0]);
                return singleUser;
            } catch (validationError) {
                 if (validationError instanceof z.ZodError) {
                    console.error("Zod validation failed:", validationError.errors);
                    throw new Error(`Output validation failed: ${validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
                } 
                throw validationError; // Rethrow other errors
            }
        });

        console.error(`Found user ${user_id}.`);
        context.log(`Found user ${user_id}.`);
        // The return type is already AuthUser (via GetAuthUserOutput)
        return user;
    },
}; 