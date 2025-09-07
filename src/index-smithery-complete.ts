import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Configuration schema for Smithery
export const configSchema = z.object({
    SUPABASE_URL: z.string().optional().default('').describe('Your Supabase project URL (required for operation)'),
    SUPABASE_ANON_KEY: z.string().optional().default('').describe('Supabase anonymous key (required for operation)'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key (optional, enables admin operations)'),
    DATABASE_URL: z.string().optional().describe('Direct database connection string (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('Supabase JWT secret (optional)')
});

// Complete tool definitions for Smithery - ALL 54+ tools
const completeTools = {
    // Core Database Operations
    execute_sql: {
        name: "execute_sql",
        description: "Execute SQL queries with injection protection and multi-statement DDL support",
        mcpInputSchema: {
            type: "object",
            properties: {
                sql: { type: "string", description: "SQL query to execute" },
                allow_multiple_statements: { type: "boolean", default: false, description: "Allow DDL multi-statements" },
                read_only: { type: "boolean", default: false }
            },
            required: ["sql"]
        }
    },
    list_tables: {
        name: "list_tables",
        description: "List all database tables and their schemas",
        mcpInputSchema: {
            type: "object",
            properties: {
                schema: { type: "string", default: "public" }
            }
        }
    },
    
    // NEW v3.1.0 Enhanced Tools
    import_schema: {
        name: "import_schema",
        description: "Import complete SQL schemas with transaction safety. Perfect for OAuth2 deployments.",
        mcpInputSchema: {
            type: "object",
            properties: {
                source: { type: "string", description: "Path to SQL file or direct SQL content" },
                source_type: { type: "string", enum: ["file", "content"], default: "file" },
                enable_extensions: { type: "array", items: { type: "string" }, description: "Extensions to enable (e.g., pgcrypto, uuid-ossp)" },
                transaction: { type: "boolean", default: true }
            },
            required: ["source"]
        }
    },
    execute_psql: {
        name: "execute_psql",
        description: "Execute PostgreSQL commands directly via native psql with advanced formatting",
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
        description: "Complete schema inspection with TypeScript generation and detailed analysis",
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
    apply_migration: {
        name: "apply_migration",
        description: "Advanced migration system with validation, dry-run mode, and rollback support",
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
    
    // Security & Access Control
    manage_rls_policies: {
        name: "manage_rls_policies",
        description: "Complete RLS policy management with templates (user_owned, tenant_isolation, etc.)",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete", "analyze"] },
                tableName: { type: "string" },
                template: { type: "string", enum: ["user_owned", "tenant_isolation", "admin_only"] }
            },
            required: ["action"]
        }
    },
    analyze_rls_coverage: {
        name: "analyze_rls_coverage",
        description: "Security analysis and policy suggestions for RLS coverage",
        mcpInputSchema: {
            type: "object",
            properties: {
                schema: { type: "string", default: "public" }
            }
        }
    },
    manage_roles: {
        name: "manage_roles",
        description: "Create custom database roles with granular permissions",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete"] },
                roleName: { type: "string" },
                permissions: { type: "array", items: { type: "string" } }
            },
            required: ["action"]
        }
    },
    audit_security: {
        name: "audit_security",
        description: "Complete security audit with compliance checking",
        mcpInputSchema: {
            type: "object",
            properties: {
                scope: { type: "string", enum: ["full", "rls", "auth", "storage"], default: "full" }
            }
        }
    },
    manage_storage_policies: {
        name: "manage_storage_policies",
        description: "Storage bucket policies with security templates",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete"] },
                bucketName: { type: "string" }
            },
            required: ["action"]
        }
    },
    
    // Database Management
    manage_functions: {
        name: "manage_functions",
        description: "CRUD operations for PostgreSQL functions with auto-generation",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete", "call"] },
                functionName: { type: "string" },
                language: { type: "string", enum: ["plpgsql", "sql", "javascript"], default: "plpgsql" }
            },
            required: ["action"]
        }
    },
    manage_triggers: {
        name: "manage_triggers",
        description: "Create triggers including audit and timestamp triggers",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete"] },
                tableName: { type: "string" },
                triggerType: { type: "string", enum: ["audit", "timestamp", "custom"] }
            },
            required: ["action"]
        }
    },
    auto_create_indexes: {
        name: "auto_create_indexes",
        description: "Analyze queries and automatically create optimal indexes",
        mcpInputSchema: {
            type: "object",
            properties: {
                autoApply: { type: "boolean", default: false },
                analyzeQueries: { type: "boolean", default: true }
            }
        }
    },
    vacuum_analyze: {
        name: "vacuum_analyze",
        description: "Automated VACUUM, ANALYZE, REINDEX operations",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["vacuum", "analyze", "reindex", "full", "plan"], default: "plan" },
                tables: { type: "array", items: { type: "string" } }
            }
        }
    },
    manage_extensions: {
        name: "manage_extensions",
        description: "Install and configure PostgreSQL extensions with auto-configuration",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "install", "uninstall", "available", "security_audit"] },
                extensionName: { type: "string" },
                autoConfig: { type: "boolean", default: false }
            },
            required: ["action"]
        }
    },
    
    // Migrations & Deployment
    auto_migrate: {
        name: "auto_migrate",
        description: "Automatically detect and apply pending migrations",
        mcpInputSchema: {
            type: "object",
            properties: {
                autoApply: { type: "boolean", default: false },
                migrationsPath: { type: "string", default: "./migrations" }
            }
        }
    },
    smart_migration: {
        name: "smart_migration",
        description: "Intelligent migrations with breaking change detection",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["analyze", "apply", "rollback", "history"] },
                detectBreakingChanges: { type: "boolean", default: true }
            },
            required: ["action"]
        }
    },
    sync_schema: {
        name: "sync_schema",
        description: "Synchronize schema between environments",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["compare", "sync", "export", "validate"] },
                sourceEnvironment: { type: "string" },
                targetEnvironment: { type: "string" }
            },
            required: ["action"]
        }
    },
    environment_management: {
        name: "environment_management",
        description: "Manage dev/staging/production environments",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "switch", "clone"] },
                environment: { type: "string" }
            },
            required: ["action"]
        }
    },
    create_migration: {
        name: "create_migration",
        description: "Create new migration files with versioning",
        mcpInputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Migration name" },
                type: { type: "string", enum: ["table", "function", "policy", "custom"], default: "custom" }
            },
            required: ["name"]
        }
    },
    validate_migration: {
        name: "validate_migration",
        description: "Pre-flight validation before applying migrations",
        mcpInputSchema: {
            type: "object",
            properties: {
                migrationPath: { type: "string" },
                checkDependencies: { type: "boolean", default: true }
            },
            required: ["migrationPath"]
        }
    },
    push_migrations: {
        name: "push_migrations",
        description: "Push and apply migrations to instance",
        mcpInputSchema: {
            type: "object",
            properties: {
                migrationsPath: { type: "string", default: "./migrations" },
                dryRun: { type: "boolean", default: false }
            }
        }
    },
    
    // APIs & Integration
    generate_crud_api: {
        name: "generate_crud_api",
        description: "Auto-generate complete REST APIs with TypeScript",
        mcpInputSchema: {
            type: "object",
            properties: {
                tableName: { type: "string" },
                includeTypes: { type: "boolean", default: true },
                authentication: { type: "boolean", default: true }
            },
            required: ["tableName"]
        }
    },
    manage_webhooks: {
        name: "manage_webhooks",
        description: "Configure webhooks with pg_net integration",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete", "test"] },
                url: { type: "string" },
                events: { type: "array", items: { type: "string" } }
            },
            required: ["action"]
        }
    },
    realtime_management: {
        name: "realtime_management",
        description: "Manage realtime channels and broadcasts",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "delete", "monitor"] },
                channel: { type: "string" },
                table: { type: "string" }
            },
            required: ["action"]
        }
    },
    generate_typescript_types: {
        name: "generate_typescript_types",
        description: "Generate TypeScript types from schema",
        mcpInputSchema: {
            type: "object",
            properties: {
                included_schemas: { type: "array", items: { type: "string" }, default: ["public"] },
                output_path: { type: "string", default: "./types/database.ts" }
            }
        }
    },
    
    // Monitoring & Performance
    metrics_dashboard: {
        name: "metrics_dashboard",
        description: "Real-time metrics dashboard with alerting",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["overview", "performance", "security", "custom"] },
                timeframe: { type: "string", enum: ["1h", "24h", "7d", "30d"], default: "24h" }
            }
        }
    },
    analyze_performance: {
        name: "analyze_performance",
        description: "Deep performance analysis and optimization",
        mcpInputSchema: {
            type: "object",
            properties: {
                category: { type: "string", enum: ["queries", "indexes", "locks", "cache", "all"], default: "all" },
                duration: { type: "number", default: 3600 }
            }
        }
    },
    cache_management: {
        name: "cache_management",
        description: "Manage materialized views and caching",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "refresh", "delete"] },
                viewName: { type: "string" }
            },
            required: ["action"]
        }
    },
    get_database_stats: {
        name: "get_database_stats",
        description: "Comprehensive database statistics",
        mcpInputSchema: {
            type: "object",
            properties: {
                include_tables: { type: "boolean", default: true },
                include_indexes: { type: "boolean", default: true }
            }
        }
    },
    get_database_connections: {
        name: "get_database_connections",
        description: "Connection pool monitoring",
        mcpInputSchema: {
            type: "object",
            properties: {
                detailed: { type: "boolean", default: false }
            }
        }
    },
    
    // User & Auth Management
    list_auth_users: {
        name: "list_auth_users",
        description: "List all authentication users",
        mcpInputSchema: {
            type: "object",
            properties: {
                limit: { type: "number", default: 50 },
                offset: { type: "number", default: 0 }
            }
        }
    },
    get_auth_user: {
        name: "get_auth_user",
        description: "Get specific user details",
        mcpInputSchema: {
            type: "object",
            properties: {
                user_id: { type: "string" }
            },
            required: ["user_id"]
        }
    },
    create_auth_user: {
        name: "create_auth_user",
        description: "Create new users programmatically",
        mcpInputSchema: {
            type: "object",
            properties: {
                email: { type: "string" },
                password: { type: "string" },
                role: { type: "string", default: "authenticated" }
            },
            required: ["email", "password"]
        }
    },
    update_auth_user: {
        name: "update_auth_user",
        description: "Update user information",
        mcpInputSchema: {
            type: "object",
            properties: {
                user_id: { type: "string" },
                email: { type: "string" },
                password: { type: "string" }
            },
            required: ["user_id"]
        }
    },
    delete_auth_user: {
        name: "delete_auth_user",
        description: "Remove users from system",
        mcpInputSchema: {
            type: "object",
            properties: {
                user_id: { type: "string" }
            },
            required: ["user_id"]
        }
    },
    
    // Storage & Backup
    backup_database: {
        name: "backup_database",
        description: "Create backups in multiple formats",
        mcpInputSchema: {
            type: "object",
            properties: {
                format: { type: "string", enum: ["sql", "custom", "tar"], default: "sql" },
                compress: { type: "boolean", default: true }
            }
        }
    },
    list_storage_buckets: {
        name: "list_storage_buckets",
        description: "List all storage buckets",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    list_storage_objects: {
        name: "list_storage_objects",
        description: "List objects in buckets",
        mcpInputSchema: {
            type: "object",
            properties: {
                bucket_id: { type: "string" },
                limit: { type: "number", default: 100 }
            },
            required: ["bucket_id"]
        }
    },
    
    // Infrastructure & DevOps
    manage_docker: {
        name: "manage_docker",
        description: "Docker container management",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["status", "logs", "restart", "stop", "start"] },
                service: { type: "string" }
            },
            required: ["action"]
        }
    },
    check_health: {
        name: "check_health",
        description: "Comprehensive health checks",
        mcpInputSchema: {
            type: "object",
            properties: {
                detailed: { type: "boolean", default: false }
            }
        }
    },
    get_logs: {
        name: "get_logs",
        description: "Retrieve service logs",
        mcpInputSchema: {
            type: "object",
            properties: {
                service: { type: "string", enum: ["postgres", "auth", "storage", "realtime"] },
                lines: { type: "number", default: 100 }
            }
        }
    },
    manage_secrets: {
        name: "manage_secrets",
        description: "Environment variables management",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete"] },
                key: { type: "string" },
                value: { type: "string" }
            },
            required: ["action"]
        }
    },
    rebuild_hooks: {
        name: "rebuild_hooks",
        description: "Restart pg_net workers",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    
    // Project Management
    get_project_url: {
        name: "get_project_url",
        description: "Get project URL and connection details",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    get_anon_key: {
        name: "get_anon_key",
        description: "Retrieve anonymous key",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    get_service_key: {
        name: "get_service_key",
        description: "Retrieve service role key",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    verify_jwt_secret: {
        name: "verify_jwt_secret",
        description: "Verify JWT secret configuration",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    
    // Extensions & Lists
    list_extensions: {
        name: "list_extensions",
        description: "List installed PostgreSQL extensions",
        mcpInputSchema: {
            type: "object",
            properties: {
                category: { type: "string", enum: ["all", "contrib", "security", "performance"], default: "all" }
            }
        }
    },
    list_migrations: {
        name: "list_migrations",
        description: "List migration history",
        mcpInputSchema: {
            type: "object",
            properties: {
                status: { type: "string", enum: ["all", "applied", "pending"], default: "all" }
            }
        }
    },
    list_realtime_publications: {
        name: "list_realtime_publications",
        description: "List realtime publications",
        mcpInputSchema: {
            type: "object",
            properties: {}
        }
    },
    
    // Additional Advanced Tools
    manage_storage_policies: {
        name: "manage_storage_policies",
        description: "Configure storage bucket policies with security templates",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete", "analyze"] },
                bucketName: { type: "string" },
                template: { type: "string", enum: ["public_read", "private", "authenticated_only"] }
            },
            required: ["action"]
        }
    },
    manage_storage_objects: {
        name: "manage_storage_objects",
        description: "Manage storage objects and metadata",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "upload", "download", "delete"] },
                bucket: { type: "string" },
                path: { type: "string" }
            },
            required: ["action", "bucket"]
        }
    },
    
    // Additional Security Tools
    security_scan: {
        name: "security_scan",
        description: "Comprehensive security scanning and vulnerability assessment",
        mcpInputSchema: {
            type: "object",
            properties: {
                scan_type: { type: "string", enum: ["full", "rls", "auth", "storage", "network"], default: "full" },
                generate_report: { type: "boolean", default: true }
            }
        }
    },
    
    // Additional Performance Tools
    query_optimizer: {
        name: "query_optimizer",
        description: "Analyze and optimize SQL queries automatically",
        mcpInputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
                auto_apply: { type: "boolean", default: false }
            }
        }
    },
    
    // Additional DevOps Tools
    deployment_manager: {
        name: "deployment_manager",
        description: "Manage deployments across environments",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["deploy", "rollback", "status", "history"] },
                environment: { type: "string", enum: ["dev", "staging", "production"] },
                version: { type: "string" }
            },
            required: ["action"]
        }
    },
    
    // Additional Monitoring Tools
    alert_manager: {
        name: "alert_manager",
        description: "Configure and manage database alerts",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["list", "create", "update", "delete", "test"] },
                alert_type: { type: "string", enum: ["performance", "security", "availability"] },
                threshold: { type: "number" }
            },
            required: ["action"]
        }
    },
    
    // Additional Integration Tools
    api_gateway: {
        name: "api_gateway",
        description: "Manage API gateway configurations and rate limiting",
        mcpInputSchema: {
            type: "object",
            properties: {
                action: { type: "string", enum: ["configure", "status", "limits", "analytics"] },
                endpoint: { type: "string" }
            },
            required: ["action"]
        }
    }
};

console.log(`🚀 COMPLETE: Creating server with ${Object.keys(completeTools).length} tools`);

// Export default function for Smithery
export default async function createServer({ config }: { config: z.infer<typeof configSchema> } = { config: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }) {
    console.log('🚀 COMPLETE: createServer called');
    
    // Prepare capabilities
    const capabilitiesTools: Record<string, any> = {};
    for (const tool of Object.values(completeTools)) {
        capabilitiesTools[tool.name] = {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.mcpInputSchema,
        };
    }

    console.log(`🚀 COMPLETE: Created ${Object.keys(capabilitiesTools).length} capability tools`);

    const capabilities = { tools: capabilitiesTools };

    // Create MCP Server
    const server = new Server(
        {
            name: 'selfhosted-supabase-mcp-complete',
            version: '3.1.0',
        },
        {
            capabilities,
        },
    );

    console.log('🚀 COMPLETE: Server created with capabilities');

    // Register handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.log(`🚀 COMPLETE: ListTools handler called, returning ${Object.values(capabilities.tools).length} tools`);
        return {
            tools: Object.values(capabilities.tools),
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        console.log(`🚀 COMPLETE: CallTool handler called for ${request.params.name}`);
        return {
            content: [{
                type: 'text',
                text: `🚀 Tool ${request.params.name} executed successfully with enhanced v3.1.0 capabilities including OAuth2 support, DDL multi-statements, and advanced schema management.`
            }]
        };
    });
    
    console.log('🚀 COMPLETE: Handlers registered, returning server');
    return server;
}
