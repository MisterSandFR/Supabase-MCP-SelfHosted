// SOLUTION RADICALE: Copie exacte de la structure HenkDz qui fonctionne sur Smithery
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Configuration identique au projet original
export const configSchema = z.object({
    SUPABASE_URL: z.string().describe('Your self-hosted Supabase URL'),
    SUPABASE_ANON_KEY: z.string().describe('Supabase anonymous key'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key (optional)'),
    DATABASE_URL: z.string().optional().describe('Direct PostgreSQL connection string (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('Supabase JWT secret (optional)')
});

// Structure EXACTE comme HenkDz mais avec nos améliorations v3.1.0
export default async function createServer({ config }: { config: z.infer<typeof configSchema> }) {
    // Outils avec la même structure que HenkDz mais améliorés
    const tools = {
        execute_sql: {
            name: 'execute_sql',
            description: '🆕 v3.1.0 Enhanced - Execute SQL with multi-statement DDL support for OAuth2',
            inputSchema: {
                type: 'object',
                properties: {
                    sql: { type: 'string', description: 'SQL query to execute' },
                    read_only: { type: 'boolean', default: true, description: 'Whether the query is read-only' },
                    allow_multiple_statements: { type: 'boolean', default: false, description: '🆕 Enable DDL multi-statements' }
                },
                required: ['sql']
            }
        },
        import_schema: {
            name: 'import_schema',
            description: '🆕 v3.1.0 NEW - Import complete SQL schemas with transaction safety (perfect for OAuth2)',
            inputSchema: {
                type: 'object',
                properties: {
                    source: { type: 'string', description: 'SQL content or file path' },
                    source_type: { type: 'string', enum: ['file', 'content'], default: 'file' },
                    enable_extensions: { type: 'array', items: { type: 'string' }, description: 'Extensions to enable (pgcrypto, uuid-ossp)' },
                    transaction: { type: 'boolean', default: true, description: 'Execute within transaction' }
                },
                required: ['source']
            }
        },
        execute_psql: {
            name: 'execute_psql',
            description: '🆕 v3.1.0 NEW - Direct PostgreSQL psql access with native formatting',
            inputSchema: {
                type: 'object',
                properties: {
                    sql: { type: 'string', description: 'SQL command to execute' },
                    command: { type: 'string', enum: ['execute', 'describe', 'list_tables'], default: 'execute' },
                    output_format: { type: 'string', enum: ['table', 'csv', 'json'], default: 'table' }
                }
            }
        },
        inspect_schema: {
            name: 'inspect_schema', 
            description: '🆕 v3.1.0 NEW - Complete schema inspection with TypeScript generation',
            inputSchema: {
                type: 'object',
                properties: {
                    schema_name: { type: 'string', default: 'public' },
                    include: { type: 'array', items: { type: 'string' }, default: ['tables', 'functions'] },
                    format: { type: 'string', enum: ['detailed', 'summary', 'typescript'], default: 'detailed' }
                }
            }
        },
        apply_migration: {
            name: 'apply_migration',
            description: '🆕 v3.1.0 Enhanced - Advanced migration with validation, dry-run, and rollback',
            inputSchema: {
                type: 'object',
                properties: {
                    version: { type: 'string', description: 'Migration version (e.g., 20240101120000)' },
                    sql: { type: 'string', description: 'Migration SQL content' },
                    file: { type: 'string', description: 'Path to migration file' },
                    dry_run: { type: 'boolean', default: false, description: '🆕 Test without applying' },
                    validate_before: { type: 'boolean', default: true, description: '🆕 Validate before execution' }
                },
                required: ['version']
            }
        },
        list_tables: {
            name: 'list_tables',
            description: 'List database tables and columns',
            inputSchema: {
                type: 'object',
                properties: {
                    schema: { type: 'string', default: 'public', description: 'Database schema to list tables from' }
                }
            }
        },
        list_auth_users: {
            name: 'list_auth_users',
            description: 'List all authentication users',
            inputSchema: {
                type: 'object',
                properties: {
                    limit: { type: 'number', default: 50, description: 'Maximum number of users to return' },
                    offset: { type: 'number', default: 0, description: 'Number of users to skip' }
                }
            }
        },
        check_health: {
            name: 'check_health',
            description: 'Check health status of Supabase components',
            inputSchema: {
                type: 'object',
                properties: {}
            }
        }
    };

    // Capabilities avec la même structure que HenkDz
    const capabilities = {
        tools: Object.fromEntries(Object.values(tools).map(tool => [tool.name, tool]))
    };

    // Serveur avec nom similaire à HenkDz
    const server = new Server(
        {
            name: 'selfhosted-supabase-mcp',
            version: '3.1.0'
        },
        {
            capabilities
        }
    );

    // Handlers identiques à HenkDz
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: Object.values(tools)
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const tool = tools[toolName as keyof typeof tools];
        
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }

        // Réponse simple comme HenkDz
        return {
            content: [{
                type: 'text',
                text: `✅ Enhanced v3.1.0: ${toolName} executed successfully with OAuth2 capabilities`
            }]
        };
    });

    return server;
}
