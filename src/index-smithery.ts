import { z } from 'zod';

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
    // Import dynamically to avoid circular dependencies
    const { createSmitheryServer } = await import('./server-smithery.js');
    
    // Create and return the server
    return createSmitheryServer({
        supabaseUrl: config.SUPABASE_URL || '',
        supabaseAnonKey: config.SUPABASE_ANON_KEY || '',
        supabaseServiceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
        databaseUrl: config.DATABASE_URL,
        supabaseAuthJwtSecret: config.SUPABASE_AUTH_JWT_SECRET
    });
}