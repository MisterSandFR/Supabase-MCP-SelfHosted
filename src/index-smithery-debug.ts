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
    },
    // NEW v3.1.0 Enhanced Tools
    import_schema: {
        name: "import_schema",
        description: "Import complete SQL schemas with transaction safety and extension management. Perfect for OAuth2 deployments.",
        mcpInputSchema: {
            type: "object",
            properties: {
                source: { type: "string", description: "Path to SQL file or direct SQL content" },
                source_type: { type: "string", enum: ["file", "content"], default: "file" },
                enable_extensions: { type: "array", items: { type: "string" }, description: "Extensions to enable (e.g., pgcrypto, uuid-ossp)" },
                transaction: { type: "boolean", default: true, description: "Execute within transaction" }
            },
            required: ["source"]
        }
    },
    execute_psql: {
        name: "execute_psql",
        description: "Execute PostgreSQL commands directly via native psql with advanced formatting options.",
        mcpInputSchema: {
            type: "object",
            properties: {
                sql: { type: "string", description: "SQL command to execute" },
                command: { type: "string", enum: ["execute", "describe", "list_tables", "list_functions"], default: "execute" },
                output_format: { type: "string", enum: ["table", "csv", "json", "html"], default: "table" }
            }
        }
    },
    inspect_schema: {
        name: "inspect_schema",
        description: "Complete schema inspection with TypeScript generation and detailed analysis.",
        mcpInputSchema: {
            type: "object",
            properties: {
                schema_name: { type: "string", default: "public" },
                include: { type: "array", items: { type: "string" }, default: ["tables", "functions", "views"] },
                format: { type: "string", enum: ["detailed", "summary", "typescript"], default: "detailed" },
                include_statistics: { type: "boolean", default: false }
            }
        }
    },
    apply_migration_enhanced: {
        name: "apply_migration_enhanced",
        description: "Advanced migration system with validation, dry-run mode, and rollback support.",
        mcpInputSchema: {
            type: "object",
            properties: {
                version: { type: "string", description: "Migration version (e.g., 20250106120000)" },
                sql: { type: "string", description: "Migration SQL content" },
                file: { type: "string", description: "Path to migration file" },
                enable_extensions: { type: "array", items: { type: "string" } },
                dry_run: { type: "boolean", default: false },
                validate_before: { type: "boolean", default: true }
            },
            required: ["version"]
        }
    },
    execute_sql_enhanced: {
        name: "execute_sql_enhanced", 
        description: "Enhanced SQL execution with multi-statement DDL support for complex operations like OAuth2 setup.",
        mcpInputSchema: {
            type: "object",
            properties: {
                sql: { type: "string", description: "SQL query to execute" },
                allow_multiple_statements: { type: "boolean", default: false, description: "Allow DDL multi-statements" },
                read_only: { type: "boolean", default: false }
            },
            required: ["sql"]
        }
    }
};

console.log(`🔍 DEBUG: Creating server with ${Object.keys(workingTools).length} tools`);

// Export default function for Smithery
export default async function createServer({ config }: { config: z.infer<typeof configSchema> } = { config: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }) {
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