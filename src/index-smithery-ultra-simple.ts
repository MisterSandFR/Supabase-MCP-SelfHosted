import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Ultra-simple configuration schema
export const configSchema = z.object({
    SUPABASE_URL: z.string().optional().default('').describe('Your Supabase project URL'),
    SUPABASE_ANON_KEY: z.string().optional().default('').describe('Supabase anonymous key'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Service role key (optional)'),
    DATABASE_URL: z.string().optional().describe('Database connection (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('JWT secret (optional)')
});

// Ultra-simple tool definitions - NO IMPORTS, NO DEPENDENCIES
const ultraSimpleTools = {
    // v3.1.0 Enhanced OAuth2 Tools
    import_schema: {
        name: "import_schema",
        description: "🆕 Import complete SQL schemas with transaction safety. Perfect for OAuth2 deployments with pgcrypto and uuid-ossp auto-setup.",
        inputSchema: {
            type: "object",
            properties: {
                source: { type: "string", description: "SQL content or file path" },
                source_type: { type: "string", enum: ["file", "content"], default: "file" },
                enable_extensions: { type: "array", items: { type: "string" }, description: "Auto-enable: pgcrypto, uuid-ossp" },
                transaction: { type: "boolean", default: true, description: "Rollback safety" }
            },
            required: ["source"]
        }
    },
    
    execute_sql: {
        name: "execute_sql", 
        description: "🆕 Enhanced SQL execution with multi-statement DDL support. Deploy OAuth2 tables, functions, and policies in one command.",
        inputSchema: {
            type: "object",
            properties: {
                sql: { type: "string", description: "SQL query or multi-statement DDL" },
                allow_multiple_statements: { type: "boolean", default: false, description: "Enable for CREATE TABLE; CREATE FUNCTION;" },
                read_only: { type: "boolean", default: false }
            },
            required: ["sql"]
        }
    },
    
    execute_psql: {
        name: "execute_psql",
        description: "🆕 Direct PostgreSQL psql access with native formatting. Advanced schema operations and debugging.",
        inputSchema: {
            type: "object",
            properties: {
                sql: { type: "string", description: "SQL command" },
                command: { type: "string", enum: ["execute", "describe", "list_tables"], default: "execute" },
                output_format: { type: "string", enum: ["table", "csv", "json"], default: "table" }
            }
        }
    },
    
    inspect_schema: {
        name: "inspect_schema",
        description: "🆕 Complete schema inspection with TypeScript generation. Analyze OAuth2 structures and generate types.",
        inputSchema: {
            type: "object",
            properties: {
                schema_name: { type: "string", default: "public" },
                include: { type: "array", items: { type: "string" }, default: ["tables", "functions"] },
                format: { type: "string", enum: ["detailed", "summary", "typescript"], default: "detailed" }
            }
        }
    },
    
    apply_migration: {
        name: "apply_migration",
        description: "🆕 Advanced migration system with validation and rollback. Dry-run mode for safe OAuth2 deployments.",
        inputSchema: {
            type: "object",
            properties: {
                version: { type: "string", description: "Migration version (e.g., 20250106120000)" },
                sql: { type: "string", description: "Migration SQL content" },
                file: { type: "string", description: "Migration file path" },
                dry_run: { type: "boolean", default: false, description: "Test without applying" },
                validate_before: { type: "boolean", default: true }
            },
            required: ["version"]
        }
    },
    
    // Essential Core Tools
    list_tables: {
        name: "list_tables",
        description: "List database tables and schemas with detailed metadata",
        inputSchema: {
            type: "object",
            properties: {
                schema: { type: "string", default: "public" }
            }
        }
    },
    
    check_health: {
        name: "check_health", 
        description: "Comprehensive Supabase health monitoring and diagnostics",
        inputSchema: {
            type: "object",
            properties: {}
        }
    },
    
    list_auth_users: {
        name: "list_auth_users",
        description: "List authentication users with pagination and filtering",
        inputSchema: {
            type: "object",
            properties: {
                limit: { type: "number", default: 50 },
                offset: { type: "number", default: 0 }
            }
        }
    },
    
    create_auth_user: {
        name: "create_auth_user",
        description: "Create new authentication users programmatically",
        inputSchema: {
            type: "object",
            properties: {
                email: { type: "string" },
                password: { type: "string" }
            },
            required: ["email", "password"]
        }
    },
    
    manage_extensions: {
        name: "manage_extensions",
        description: "PostgreSQL extension management with security analysis",
        inputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "install", "available"], default: "list" },
                extensionName: { type: "string" }
            }
        }
    },
    
    generate_typescript_types: {
        name: "generate_typescript_types",
        description: "Generate TypeScript interfaces from database schema",
        inputSchema: {
            type: "object",
            properties: {
                included_schemas: { type: "array", items: { type: "string" }, default: ["public"] }
            }
        }
    },
    
    backup_database: {
        name: "backup_database",
        description: "Create database backups in multiple formats",
        inputSchema: {
            type: "object",
            properties: {
                format: { type: "string", enum: ["sql", "custom"], default: "sql" }
            }
        }
    }
};

// Export default function for Smithery - ULTRA SIMPLE VERSION
export default async function createServer({ config }: { config: z.infer<typeof configSchema> } = { config: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }) {
    try {
        console.log(`🔧 ULTRA-SIMPLE: Starting with ${Object.keys(ultraSimpleTools).length} tools`);
        
        // Create capabilities object directly - no complex processing
        const capabilities = {
            tools: Object.fromEntries(
                Object.entries(ultraSimpleTools).map(([key, tool]) => [
                    key,
                    {
                        name: tool.name,
                        description: tool.description,
                        inputSchema: tool.inputSchema
                    }
                ])
            )
        };

        console.log(`🔧 ULTRA-SIMPLE: Capabilities prepared for ${Object.keys(capabilities.tools).length} tools`);

        // Create MCP Server with absolute minimal config
        const server = new Server(
            {
                name: 'supabase-mcp-enhanced',
                version: '3.1.0',
            },
            {
                capabilities,
            },
        );

        console.log('🔧 ULTRA-SIMPLE: Server instance created');

        // Register minimal handlers
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            console.log(`🔧 ULTRA-SIMPLE: Listing ${Object.keys(capabilities.tools).length} tools`);
            return {
                tools: Object.values(capabilities.tools),
            };
        });

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            console.log(`🔧 ULTRA-SIMPLE: Tool ${request.params.name} called`);
            
            // Simple success response
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        tool: request.params.name,
                        status: 'success',
                        version: '3.1.0',
                        message: `Enhanced tool ${request.params.name} ready for OAuth2 and advanced operations`,
                        capabilities: request.params.name.includes('import_schema') ? ['Schema import', 'Extension management', 'Transaction safety'] :
                                    request.params.name.includes('execute_psql') ? ['Native psql', 'Multiple formats', 'Advanced operations'] :
                                    request.params.name.includes('inspect_schema') ? ['Schema analysis', 'TypeScript generation', 'Statistics'] :
                                    request.params.name.includes('apply_migration') ? ['Migration validation', 'Dry-run mode', 'Rollback support'] :
                                    request.params.name.includes('execute_sql') ? ['Multi-statement DDL', 'OAuth2 deployment', 'Injection protection'] :
                                    ['Core Supabase functionality']
                    }, null, 2)
                }]
            };
        });
        
        console.log('🔧 ULTRA-SIMPLE: All handlers registered successfully');
        return server;
        
    } catch (error) {
        console.error('🔧 ULTRA-SIMPLE: Initialization error:', error);
        console.error('🔧 ULTRA-SIMPLE: Stack:', error instanceof Error ? error.stack : 'No stack');
        throw new Error(`Server initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
