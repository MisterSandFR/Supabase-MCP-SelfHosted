import { z } from 'zod';

// Configuration schema for Smithery
export const configSchema = z.object({
    SUPABASE_URL: z.string().optional().default('').describe('Your Supabase project URL (required for operation)'),
    SUPABASE_ANON_KEY: z.string().optional().default('').describe('Your Supabase anonymous key (required for operation)'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key (optional)'),
    DATABASE_URL: z.string().optional().describe('Direct database connection string (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('Supabase JWT secret (optional)')
});

// Export default function for Smithery
export default async function createServer({ config }: { config: z.infer<typeof configSchema> }) {
    try {
        // Import dynamically to avoid circular dependencies
        const { createSmitheryServer } = await import('./server-smithery.js');
        
        // Create and return the server
        const server = await createSmitheryServer({
            supabaseUrl: config.SUPABASE_URL || '',
            supabaseAnonKey: config.SUPABASE_ANON_KEY || '',
            supabaseServiceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
            databaseUrl: config.DATABASE_URL,
            supabaseAuthJwtSecret: config.SUPABASE_AUTH_JWT_SECRET
        });
        
        return server;
    } catch (error) {
        // Log error for debugging
        console.error('Failed to create server:', error);
        
        // Return a minimal server on error
        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        return new Server({
            name: 'selfhosted-supabase-mcp',
            version: '2.1.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
    }
}