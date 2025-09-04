// Debug version of index-smithery.ts with detailed logging
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Configuration schema for Smithery
export const configSchema = z.object({
    SUPABASE_URL: z.string().optional().default('').describe('Your Supabase project URL (required for operation)'),
    SUPABASE_ANON_KEY: z.string().optional().default('').describe('Your Supabase anonymous key (required for operation)'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key (optional)'),
    DATABASE_URL: z.string().optional().describe('Direct database connection string (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('Supabase JWT secret (optional)')
});

// Create a simplified version with the 8 working tools plus some others
const workingTools = {
    execute_sql: {
        name: "execute_sql",
        description: "Execute SQL queries with injection protection",
        mcpInputSchema: {
            type: "object",
            properties: {
                sql: { type: "string", description: "SQL query to execute" }
            },
            required: ["sql"]
        }
    },
    list_tables: {
        name: "list_tables",
        description: "List all database tables and their schemas",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    check_health: {
        name: "check_health",
        description: "Check health status of all Supabase components",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    backup_database: {
        name: "backup_database",
        description: "Create a database backup",
        mcpInputSchema: {
            type: "object",
            properties: {
                format: { type: "string", enum: ["sql", "custom", "tar"] }
            }
        }
    },
    analyze_performance: {
        name: "analyze_performance",
        description: "Analyze database performance metrics",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    manage_docker: {
        name: "manage_docker",
        description: "Manage Docker containers for self-hosted Supabase",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["status", "logs", "restart"] }
            },
            required: ["action"]
        }
    },
    validate_migration: {
        name: "validate_migration",
        description: "Validate a migration file before applying",
        mcpInputSchema: {
            type: "object",
            properties: {
                migrationPath: { type: "string" }
            },
            required: ["migrationPath"]
        }
    },
    get_logs: {
        name: "get_logs",
        description: "Retrieve logs from Supabase services",
        mcpInputSchema: {
            type: "object",
            properties: {
                service: { type: "string", enum: ["postgres", "auth", "storage", "realtime"] }
            }
        }
    }
};

console.log(`🔍 DEBUG: Creating server with ${Object.keys(workingTools).length} tools`);

// Export default function for Smithery
export default function createServer({ config }: { config: z.infer<typeof configSchema> } = { config: {} }) {
    console.log('🔍 DEBUG: createServer called');
    
    // Prepare capabilities
    const capabilitiesTools: Record<string, any> = {};
    for (const tool of Object.values(workingTools)) {
        capabilitiesTools[tool.name] = {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.mcpInputSchema,
        };
    }

    console.log(`🔍 DEBUG: Created ${Object.keys(capabilitiesTools).length} capability tools`);

    const capabilities = { tools: capabilitiesTools };

    // Create MCP Server
    const server = new Server(
        {
            name: 'selfhosted-supabase-mcp-debug',
            version: '3.0.0-debug',
        },
        {
            capabilities,
        },
    );

    console.log('🔍 DEBUG: Server created with capabilities');

    // Register handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.log(`🔍 DEBUG: ListTools handler called, returning ${Object.values(capabilities.tools).length} tools`);
        return {
            tools: Object.values(capabilities.tools),
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        console.log(`🔍 DEBUG: CallTool handler called for ${request.params.name}`);
        return {
            content: [{
                type: 'text',
                text: `DEBUG: Tool ${request.params.name} would be executed.`
            }]
        };
    });
    
    console.log('🔍 DEBUG: Handlers registered, returning server');
    return server;
}