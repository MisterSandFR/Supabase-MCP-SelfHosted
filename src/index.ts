import { Command } from 'commander';
import { startStandaloneServer } from './smithery.js';

// Export for Smithery
export { default } from './smithery.js';
export { configSchema } from './smithery.js';

// Main function for CLI execution
async function main() {
    const program = new Command();

    program
        .name('self-hosted-supabase-mcp')
        .description('MCP Server for self-hosted Supabase instances')
        .option('--url <url>', 'Supabase project URL', process.env.SUPABASE_URL || process.env.supabaseUrl)
        .option('--anon-key <key>', 'Supabase anonymous key', process.env.SUPABASE_ANON_KEY || process.env.supabaseAnonKey)
        .option('--service-key <key>', 'Supabase service role key (optional)', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabaseServiceRoleKey)
        .option('--db-url <url>', 'Direct database connection string (optional, for pg fallback)', process.env.DATABASE_URL || process.env.databaseUrl)
        .option('--jwt-secret <secret>', 'Supabase JWT secret (optional, needed for some tools)', process.env.SUPABASE_AUTH_JWT_SECRET || process.env.supabaseAuthJwtSecret)
        .option('--workspace-path <path>', 'Workspace root path (for file operations)', process.cwd())
        .option('--tools-config <path>', 'Path to a JSON file specifying which tools to enable')
        .parse(process.argv);

    const options = program.opts();

    if (!options.url) {
        console.error('Error: Supabase URL is required. Use --url or SUPABASE_URL.');
        throw new Error('Supabase URL is required.');
    }
    if (!options.anonKey) {
        console.error('Error: Supabase Anon Key is required. Use --anon-key or SUPABASE_ANON_KEY.');
        throw new Error('Supabase Anon Key is required.');
    }

    console.error('Starting Self-Hosted Supabase MCP Server...');

    try {
        await startStandaloneServer({
            url: options.url,
            anonKey: options.anonKey,
            serviceKey: options.serviceKey,
            dbUrl: options.dbUrl,
            jwtSecret: options.jwtSecret,
            workspacePath: options.workspacePath,
            toolsConfig: options.toolsConfig
        });
    } catch (error) {
        console.error('Failed to start the MCP server:', error);
        throw error;
    }
}

// Only run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}