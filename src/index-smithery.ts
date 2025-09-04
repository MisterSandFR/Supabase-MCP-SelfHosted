import { z } from 'zod';
import createServerFunc, { configSchema as mainConfigSchema } from './server.js';

// Configuration schema for Smithery
export const configSchema = z.object({
    SUPABASE_URL: z.string().optional().default('').describe('Your Supabase project URL (required for operation)'),
    SUPABASE_ANON_KEY: z.string().optional().default('').describe('Your Supabase anonymous key (required for operation)'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key (optional)'),
    DATABASE_URL: z.string().optional().describe('Direct database connection string (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('Supabase JWT secret (optional)')
});

// Export default function for Smithery
export default function createServer({ config }: { config: z.infer<typeof configSchema> } = { config: {} }) {
    // Convert Smithery config to main server config format
    const serverConfig = {
        supabaseUrl: config?.SUPABASE_URL || '',
        supabaseAnonKey: config?.SUPABASE_ANON_KEY || '',
        supabaseServiceRoleKey: config?.SUPABASE_SERVICE_ROLE_KEY,
        databaseUrl: config?.DATABASE_URL,
        supabaseAuthJwtSecret: config?.SUPABASE_AUTH_JWT_SECRET
    };

    // Use the main server function which has all 50+ tools
    return createServerFunc(serverConfig);
}