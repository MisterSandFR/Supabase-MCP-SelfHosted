import { z } from 'zod';
import type { ToolContext } from './types.js';
import { handleSqlResponse } from './utils.js';
import type { PoolClient } from 'pg';
import type { SqlSuccessResponse, AuthUser } from '../types/index.js'; // Import AuthUser
import { validatePassword, validateEmail, hashForLogging, maskSensitiveData } from '../utils/auth-security.js';

// Input schema with enhanced validation
const CreateAuthUserInputSchema = z.object({
    email: z.string().email().describe('The email address for the new user.'),
    password: z.string().min(8).describe('Password (min 8 chars, must include uppercase, lowercase, number, and special character).'),
    role: z.string().optional().describe('User role.'),
    app_metadata: z.record(z.unknown()).optional().describe('Optional app metadata.'),
    user_metadata: z.record(z.unknown()).optional().describe('Optional user metadata.'),
});
type CreateAuthUserInput = z.infer<typeof CreateAuthUserInputSchema>;

// Output schema - Zod validation for the created user (should match AuthUser structure)
const CreatedAuthUserZodSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    role: z.string().nullable(),
    created_at: z.string().nullable(),
    last_sign_in_at: z.string().nullable(), // Will likely be null on creation
    raw_app_meta_data: z.record(z.unknown()).nullable(),
    raw_user_meta_data: z.record(z.unknown()).nullable(),
    // Add other fields returned by the INSERT if necessary
});
// Use AuthUser for the output type hint
type CreateAuthUserOutput = AuthUser;

// Static JSON Schema for MCP capabilities
const mcpInputSchema = {
    type: 'object',
    properties: {
        email: { type: 'string', format: 'email', description: 'The email address for the new user.' },
        password: { type: 'string', minLength: 6, description: 'Plain text password (min 6 chars). WARNING: Insecure.' },
        role: { type: 'string', default: 'authenticated', description: 'User role.' },
        user_metadata: { type: 'object', description: 'Optional user metadata.' },
        app_metadata: { type: 'object', description: 'Optional app metadata.' },
    },
    required: ['email', 'password'],
};

// Tool definition
export const createAuthUserTool = {
    name: 'create_auth_user',
    description: 'Creates a new user directly in auth.users. WARNING: Requires plain password, insecure. Use with extreme caution.',
    inputSchema: CreateAuthUserInputSchema,
    mcpInputSchema: mcpInputSchema, // Ensure defined above
    outputSchema: CreatedAuthUserZodSchema,

    execute: async (input: CreateAuthUserInput, context: ToolContext): Promise<CreateAuthUserOutput> => { // Use CreateAuthUserOutput
        const client = context.selfhostedClient;
        const { email, password, role, app_metadata, user_metadata } = input;

        // Validate email format
        if (!validateEmail(email)) {
            throw new Error('Invalid email format');
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            throw new Error(`Password validation failed: ${passwordValidation.errors?.join(', ')}`);
        }

        // Direct DB connection is absolutely required for this direct insert
        if (!client.isPgAvailable()) {
             context.log('Direct database connection (DATABASE_URL) is required to create an auth user directly.', 'error');
            throw new Error('Direct database connection (DATABASE_URL) is required to create an auth user directly.');
        }

        // Log safely without exposing password
        const hashedEmail = hashForLogging(email);
        console.warn(`Creating user with email hash ${hashedEmail}`);
        context.log(`Attempting to create user ${email}...`, 'info');

        // Use transaction to ensure atomicity and get pg client
        const createdUser = await client.executeTransactionWithPg(async (pgClient: PoolClient) => {
            // Check if pgcrypto extension is available (needed for crypt)
            try {
                await pgClient.query("SELECT crypt('test', gen_salt('bf'))");
            } catch (err) {
                 throw new Error('Failed to execute crypt function. Ensure pgcrypto extension is enabled in the database.');
            }
            
            // Construct the INSERT statement with parameterization
            const sql = `
                INSERT INTO auth.users (
                    instance_id, email, encrypted_password, role,
                    raw_app_meta_data, raw_user_meta_data, 
                    aud, email_confirmed_at, confirmation_sent_at -- Set required defaults
                )
                VALUES (
                    COALESCE(current_setting('app.instance_id', TRUE), '00000000-0000-0000-0000-000000000000')::uuid,
                    $1, crypt($2, gen_salt('bf')),
                    $3,
                    $4::jsonb,
                    $5::jsonb,
                    'authenticated', now(), now()
                )
                RETURNING id, email, role, raw_app_meta_data, raw_user_meta_data, created_at::text, last_sign_in_at::text;
            `;

            const params = [
                email,
                password,
                role || 'authenticated', // Default role
                JSON.stringify(app_metadata || {}),
                JSON.stringify(user_metadata || {})
            ];

            try {
                const result = await pgClient.query(sql, params);
                if (result.rows.length === 0) {
                     throw new Error('User creation failed, no user returned after insert.');
                }
                return CreatedAuthUserZodSchema.parse(result.rows[0]);
            } catch (dbError: unknown) {
                let errorMessage = 'Unknown database error during user creation';
                let isUniqueViolation = false;

                if (typeof dbError === 'object' && dbError !== null && 'code' in dbError) {
                    // Check PG error code for unique violation safely
                    if (dbError.code === '23505') {
                        isUniqueViolation = true;
                        errorMessage = `User creation failed: Email '${email}' likely already exists.`;
                    } else if ('message' in dbError && typeof dbError.message === 'string') {
                         errorMessage = `Database error (${dbError.code}): ${dbError.message}`;
                    } else {
                        errorMessage = `Database error code: ${dbError.code}`;
                    }
                } else if (dbError instanceof Error) {
                    errorMessage = `Database error during user creation: ${dbError.message}`;
                } else {
                     errorMessage = `Database error during user creation: ${String(dbError)}`;
                }

                // Log error safely without exposing sensitive data
                const safeError = maskSensitiveData(dbError);
                console.error('Error creating user in DB:', safeError);

                // Throw a specific error message
                throw new Error(errorMessage);
            }
        });

        console.error(`Successfully created user ${email} with ID ${createdUser.id}.`);
        context.log(`Successfully created user ${email} with ID ${createdUser.id}.`);
        return createdUser; // Matches CreateAuthUserOutput (AuthUser)
    },
}; 