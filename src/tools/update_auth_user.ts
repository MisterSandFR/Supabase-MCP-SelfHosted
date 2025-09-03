import { z } from 'zod';
import type { ToolContext } from './types.js';

import type { PoolClient } from 'pg';
import type { AuthUser } from '../types/index.js'; // Import AuthUser
import { validatePassword, validateEmail, hashForLogging, maskSensitiveData } from '../utils/auth-security.js';

// Input schema with enhanced validation
const UpdateAuthUserInputSchema = z.object({
    user_id: z.string().uuid().describe('The UUID of the user to update.'),
    email: z.string().email().optional().describe('New email address.'),
    password: z.string().min(8).optional().describe('New password (min 8 chars, must include uppercase, lowercase, number, and special character).'),
    role: z.string().optional().describe('New role.'),
    app_metadata: z.record(z.unknown()).optional().describe('New app metadata (will overwrite existing).'),
    user_metadata: z.record(z.unknown()).optional().describe('New user metadata (will overwrite existing).'),
}).refine(data => 
    data.email || data.password || data.role || data.app_metadata || data.user_metadata,
    { message: "At least one field to update (email, password, role, app_metadata, user_metadata) must be provided." }
);
type UpdateAuthUserInput = z.infer<typeof UpdateAuthUserInputSchema>;

// Output schema - Zod validation for the updated user
const UpdatedAuthUserZodSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    role: z.string().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(), // Expect this to be updated
    last_sign_in_at: z.string().nullable(),
    raw_app_meta_data: z.record(z.unknown()).nullable(),
    raw_user_meta_data: z.record(z.unknown()).nullable(),
});
// Use AuthUser for the output type hint
type UpdateAuthUserOutput = AuthUser;

// Static JSON Schema for MCP
const mcpInputSchema = {
    type: 'object',
    properties: {
        user_id: { type: 'string', format: 'uuid', description: 'The UUID of the user to update.' },
        email: { type: 'string', format: 'email', description: 'New email address.' },
        password: { type: 'string', minLength: 6, description: 'New plain text password (min 6 chars). WARNING: Insecure.' },
        role: { type: 'string', description: 'New role.' },
        user_metadata: { type: 'object', description: 'New user metadata (will overwrite existing).' },
        app_metadata: { type: 'object', description: 'New app metadata (will overwrite existing).' },
    },
    required: ['user_id'],
};

// Tool definition
export const updateAuthUserTool = {
    name: 'update_auth_user',
    description: 'Updates fields for a user in auth.users. WARNING: Password handling is insecure. Requires service_role key and direct DB connection.',
    inputSchema: UpdateAuthUserInputSchema,
    mcpInputSchema: mcpInputSchema, // Ensure defined
    outputSchema: UpdatedAuthUserZodSchema,

    execute: async (input: UpdateAuthUserInput, context: ToolContext): Promise<UpdateAuthUserOutput> => { // Use UpdateAuthUserOutput
        const client = context.selfhostedClient;
        const { user_id, email, password, role, app_metadata, user_metadata } = input;

        // Validate email if provided
        if (email !== undefined && !validateEmail(email)) {
            throw new Error('Invalid email format');
        }

        // Validate password strength if provided
        if (password !== undefined) {
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors?.join(', ')}`);
            }
        }

        if (!client.isPgAvailable()) {
            context.log('Direct database connection (DATABASE_URL) is required to update auth user details.', 'error');
            throw new Error('Direct database connection (DATABASE_URL) is required to update auth user details.');
        }

        const updates: string[] = [];
        const params: (string | object | null)[] = [];
        let paramIndex = 1;

        // Dynamically build SET clauses and params array
        if (email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            params.push(email);
        }
        if (password !== undefined) {
            updates.push(`encrypted_password = crypt($${paramIndex++}, gen_salt('bf'))`);
            params.push(password);
            // Log safely without exposing password
            const hashedUserId = hashForLogging(user_id);
            console.warn(`Updating password for user with ID hash ${hashedUserId}`);
        }
        if (role !== undefined) {
            updates.push(`role = $${paramIndex++}`);
            params.push(role);
        }
        if (app_metadata !== undefined) {
            updates.push(`raw_app_meta_data = $${paramIndex++}::jsonb`);
            params.push(JSON.stringify(app_metadata));
        }
        if (user_metadata !== undefined) {
            updates.push(`raw_user_meta_data = $${paramIndex++}::jsonb`);
            params.push(JSON.stringify(user_metadata));
        }

        // Add user_id as the final parameter for the WHERE clause
        params.push(user_id);
        const userIdParamIndex = paramIndex;

        const sql = `
            UPDATE auth.users
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE id = $${userIdParamIndex}
            RETURNING id, email, role, raw_app_meta_data, raw_user_meta_data, created_at::text, updated_at::text, last_sign_in_at::text;
        `;

        console.error(`Attempting to update auth user ${user_id}...`);
        context.log(`Attempting to update auth user ${user_id}...`);

        const updatedUser = await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
             // Check pgcrypto if password is being updated
             if (password !== undefined) {
                try {
                    await pgClient.query("SELECT crypt('test', gen_salt('bf'))");
                } catch (err) {
                    throw new Error('Failed to execute crypt function for password update. Ensure pgcrypto extension is enabled.');
                }
             }

            try {
                const result = await pgClient.query(sql, params);
                if (result.rows.length === 0) {
                    throw new Error(`User update failed: User with ID ${user_id} not found or no rows affected.`);
                }
                return UpdatedAuthUserZodSchema.parse(result.rows[0]);
            } catch (dbError: unknown) {
                let errorMessage = 'Unknown database error during user update';
                let isUniqueViolation = false;

                // Check for potential email unique constraint violation if email was updated
                if (typeof dbError === 'object' && dbError !== null && 'code' in dbError) {
                    if (email !== undefined && dbError.code === '23505') {
                        isUniqueViolation = true;
                        errorMessage = `User update failed: Email '${email}' likely already exists for another user.`;
                    } else if ('message' in dbError && typeof dbError.message === 'string') {
                        errorMessage = `Database error (${dbError.code}): ${dbError.message}`;
                    } else {
                        errorMessage = `Database error code: ${dbError.code}`;
                    }
                } else if (dbError instanceof Error) {
                     errorMessage = `Database error during user update: ${dbError.message}`;
                } else {
                     errorMessage = `Database error during user update: ${String(dbError)}`;
                }

                // Log error safely without exposing sensitive data
                const safeError = maskSensitiveData(dbError);
                console.error('Error updating user in DB:', safeError);
                
                // Throw the specific error message
                throw new Error(errorMessage);
            }
        });

        console.error(`Successfully updated user ${user_id}.`);
        context.log(`Successfully updated user ${user_id}.`);
        return updatedUser; // Matches UpdateAuthUserOutput (AuthUser)
    },
}; 