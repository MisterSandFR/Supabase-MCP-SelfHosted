import { z } from "zod";
import { ToolContext } from "./types.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { handleSqlResponse, isSqlErrorResponse } from './utils.js';

// Input schema: User ID
const DeleteAuthUserInputSchema = z.object({
    user_id: z.string().uuid().describe('The UUID of the user to delete.'),
});
type DeleteAuthUserInput = z.infer<typeof DeleteAuthUserInputSchema>;

// Output schema: Success status and message
const DeleteAuthUserOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        user_id: {
            type: 'string',
            format: 'uuid',
            description: 'The UUID of the user to delete.',
        },
    },
    required: ['user_id'],
};

// Tool definition
export const deleteAuthUserTool = {
    name: 'delete_auth_user',
    description: 'Deletes a user from auth.users by their ID. Requires service_role key and direct DB connection.',
    inputSchema: DeleteAuthUserInputSchema,
    mcpInputSchema: mcpInputSchema,
    outputSchema: DeleteAuthUserOutputSchema,

    execute: async (input: unknown, context: ToolContext) => {
        const client = context.selfhostedClient;
        const { user_id } = input;

        // This operation requires elevated privileges and modifies data.
        // Prefer direct DB connection if available and service key is configured.
        if (!client.isPgAvailable()) {
            throw new Error('Direct database connection (DATABASE_URL) is required for deleting users but is not configured or available.');
        }
        // Service role key check remains relevant for awareness, but remove console.warn
        // if (!client.getServiceRoleKey()) {
        //      console.warn('Service role key not explicitly configured, direct DB connection might fail if privileges are insufficient.');
        // }

        try {
            // Use executeTransactionWithPg for safety, though it's a single statement
            const result = await client.executeTransactionWithPg(async (pgClient) => {
                // Use parameter binding for safety
                const deleteResult = await pgClient.query(
                    'DELETE FROM auth.users WHERE id = $1',
                    [user_id]
                );
                return deleteResult;
            });

            if (result.rowCount === 1) {
                return {
                    success: true,
                    message: `Successfully deleted user with ID: ${user_id}`,
                };
            }
            // If rowCount was not 1, the user wasn't found/deleted
            return {
                success: false,
                message: `User with ID ${user_id} not found or could not be deleted.`,
            };

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error deleting user ${user_id}:`, errorMessage);
            // Rethrow for the main handler to format the error response
            throw new Error(`Failed to delete user ${user_id}: ${errorMessage}`); 
        }
    },
}; 