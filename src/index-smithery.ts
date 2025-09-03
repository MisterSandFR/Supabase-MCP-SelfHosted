import { z } from 'zod';
import createServerFromConfig from './server.js';

// Configuration schema for Smithery
export const configSchema = z.object({
    SUPABASE_URL: z.string().describe('Your Supabase project URL'),
    SUPABASE_ANON_KEY: z.string().describe('Your Supabase anonymous key'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key (optional)'),
    DATABASE_URL: z.string().optional().describe('Direct database connection string (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('Supabase JWT secret (optional)')
});

// Export default function for Smithery
export default async function createServer({ config }: { config: z.infer<typeof configSchema> }) {
    // Create the server with the provided configuration
    const serverInstance = await createServerFromConfig({
        supabaseUrl: config.SUPABASE_URL,
        supabaseAnonKey: config.SUPABASE_ANON_KEY,
        supabaseServiceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
        databaseUrl: config.DATABASE_URL,
        supabaseAuthJwtSecret: config.SUPABASE_AUTH_JWT_SECRET
    });

    // Return just the server object for Smithery
    return serverInstance.server;
}