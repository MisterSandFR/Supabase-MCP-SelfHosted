import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SelfhostedSupabaseClient } from './client/index.js';
import { listTablesTool } from './tools/list_tables.js';
import { listExtensionsTool } from './tools/list_extensions.js';
import { listMigrationsTool } from './tools/list_migrations.js';
import { applyMigrationTool } from './tools/apply_migration.js';
import { executeSqlTool } from './tools/execute_sql.js';
import { getDatabaseConnectionsTool } from './tools/get_database_connections.js';
import { getDatabaseStatsTool } from './tools/get_database_stats.js';
import { getProjectUrlTool } from './tools/get_project_url.js';
import { getAnonKeyTool } from './tools/get_anon_key.js';
import { getServiceKeyTool } from './tools/get_service_key.js';
import { generateTypesTool } from './tools/generate_typescript_types.js';
import { rebuildHooksTool } from './tools/rebuild_hooks.js';
import { verifyJwtSecretTool } from './tools/verify_jwt_secret.js';
import { listAuthUsersTool } from './tools/list_auth_users.js';
import { getAuthUserTool } from './tools/get_auth_user.js';
import { deleteAuthUserTool } from './tools/delete_auth_user.js';
import { createAuthUserTool } from './tools/create_auth_user.js';
import { updateAuthUserTool } from './tools/update_auth_user.js';
import type { ToolContext } from './tools/types.js';
import { getLogsTool } from './tools/get_logs.js';
import { listStorageBucketsTool } from './tools/list_storage_buckets.js';
import { listStorageObjectsTool } from './tools/list_storage_objects.js';
import { listRealtimePublicationsTool } from './tools/list_realtime_publications.js';
import { checkHealthTool } from './tools/check_health.js';
import { backupDatabaseTool } from './tools/backup_database.js';
import { manageDockerTool } from './tools/manage_docker.js';
import { analyzePerformanceTool } from './tools/analyze_performance.js';
import { validateMigrationTool } from './tools/validate_migration.js';
import { pushMigrationsTool } from './tools/push_migrations.js';
import { createMigrationTool } from './tools/create_migration.js';
import { autoMigrateTool } from './tools/auto_migrate.js';
import { manageRlsPoliciesTool } from './tools/manage_rls_policies.js';
import { analyzeRlsCoverageTool } from './tools/analyze_rls_coverage.js';
import { manageFunctionsTool } from './tools/manage_functions.js';
import { manageTriggersTool } from './tools/manage_triggers.js';
import { autoCreateIndexesTool } from './tools/auto_create_indexes.js';
import { manageRolesTool } from './tools/manage_roles.js';
import { manageStoragePolicies } from './tools/manage_storage_policies.js';
import { vacuumAnalyzeTool } from './tools/vacuum_analyze.js';
import { manageExtensionsTool } from './tools/manage_extensions.js';
import { syncSchemaTool } from './tools/sync_schema.js';
import { manageSecretsTool } from './tools/manage_secrets.js';
import { auditSecurityTool } from './tools/audit_security.js';
import { generateCrudApiTool } from './tools/generate_crud_api.js';
import { manageWebhooksTool } from './tools/manage_webhooks.js';
import { cacheManagementTool } from './tools/cache_management.js';
import { realtimeManagementTool } from './tools/realtime_management.js';
import { environmentManagementTool } from './tools/environment_management.js';
import { smartMigrationTool } from './tools/smart_migration.js';
import { metricsDashboardTool } from './tools/metrics_dashboard.js';
import { RateLimiter, ConcurrencyLimiter, QueryComplexityAnalyzer, withResourceLimits } from './utils/rate-limiter.js';

// Export the configuration schema
export const configSchema = z.object({
    supabaseUrl: z.string().describe('Self-hosted Supabase HTTP(S) URL'),
    supabaseAnonKey: z.string().describe('Supabase anonymous key'),
    supabaseServiceRoleKey: z.string().optional().describe('Service role key for privileged operations'),
    databaseUrl: z.string().optional().describe('Direct PostgreSQL connection string'),
    supabaseAuthJwtSecret: z.string().optional().describe('JWT secret for token verification'),
});

export type Config = z.infer<typeof configSchema>;

// Define the structure expected by MCP for tool definitions
interface McpToolSchema {
    name: string;
    description?: string;
    inputSchema: object; 
}

interface AppTool {
    name: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    mcpInputSchema: object;
    outputSchema: z.ZodTypeAny;
    execute: (input: unknown, context: ToolContext) => Promise<unknown>;
}

// Initialize rate limiters
const rateLimiter = new RateLimiter(100, 60000);
const concurrencyLimiter = new ConcurrencyLimiter(10);
const queryAnalyzer = new QueryComplexityAnalyzer();

// Main server creation function
export default async function createServer(config: Config) {
    // Don't log to stderr in production/Smithery environment
    if (process.env.NODE_ENV !== 'production') {
        console.error('Creating Self-Hosted Supabase MCP Server with config...');
    }
    
    // Create Supabase client
    const selfhostedClient = await SelfhostedSupabaseClient.create({
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
        supabaseServiceRoleKey: config.supabaseServiceRoleKey,
        databaseUrl: config.databaseUrl,
        jwtSecret: config.supabaseAuthJwtSecret,
    });

    const availableTools = {
        [listTablesTool.name]: listTablesTool as AppTool,
        [listExtensionsTool.name]: listExtensionsTool as AppTool,
        [listMigrationsTool.name]: listMigrationsTool as AppTool,
        [applyMigrationTool.name]: applyMigrationTool as AppTool,
        [executeSqlTool.name]: executeSqlTool as AppTool,
        [getDatabaseConnectionsTool.name]: getDatabaseConnectionsTool as AppTool,
        [getDatabaseStatsTool.name]: getDatabaseStatsTool as AppTool,
        [getProjectUrlTool.name]: getProjectUrlTool as AppTool,
        [getAnonKeyTool.name]: getAnonKeyTool as AppTool,
        [getServiceKeyTool.name]: getServiceKeyTool as AppTool,
        [generateTypesTool.name]: generateTypesTool as AppTool,
        [rebuildHooksTool.name]: rebuildHooksTool as AppTool,
        [verifyJwtSecretTool.name]: verifyJwtSecretTool as AppTool,
        [listAuthUsersTool.name]: listAuthUsersTool as AppTool,
        [getAuthUserTool.name]: getAuthUserTool as AppTool,
        [deleteAuthUserTool.name]: deleteAuthUserTool as AppTool,
        [createAuthUserTool.name]: createAuthUserTool as AppTool,
        [updateAuthUserTool.name]: updateAuthUserTool as AppTool,
        [listStorageBucketsTool.name]: listStorageBucketsTool as AppTool,
        [listStorageObjectsTool.name]: listStorageObjectsTool as AppTool,
        [listRealtimePublicationsTool.name]: listRealtimePublicationsTool as AppTool,
        [getLogsTool.name]: getLogsTool as AppTool,
        [checkHealthTool.name]: checkHealthTool as AppTool,
        [backupDatabaseTool.name]: backupDatabaseTool as AppTool,
        [manageDockerTool.name]: manageDockerTool as AppTool,
        [analyzePerformanceTool.name]: analyzePerformanceTool as AppTool,
        [validateMigrationTool.name]: validateMigrationTool as AppTool,
        [pushMigrationsTool.name]: pushMigrationsTool as AppTool,
        [createMigrationTool.name]: createMigrationTool as AppTool,
        [autoMigrateTool.name]: autoMigrateTool as AppTool,
        [manageRlsPoliciesTool.name]: manageRlsPoliciesTool as AppTool,
        [analyzeRlsCoverageTool.name]: analyzeRlsCoverageTool as AppTool,
        [manageFunctionsTool.name]: manageFunctionsTool as AppTool,
        [manageTriggersTool.name]: manageTriggersTool as AppTool,
        [autoCreateIndexesTool.name]: autoCreateIndexesTool as AppTool,
        [manageRolesTool.name]: manageRolesTool as AppTool,
        [manageStoragePolicies.name]: manageStoragePolicies as AppTool,
        [vacuumAnalyzeTool.name]: vacuumAnalyzeTool as AppTool,
        [manageExtensionsTool.name]: manageExtensionsTool as AppTool,
        [syncSchemaTool.name]: syncSchemaTool as AppTool,
        [manageSecretsTool.name]: manageSecretsTool as AppTool,
        [auditSecurityTool.name]: auditSecurityTool as AppTool,
        [generateCrudApiTool.name]: generateCrudApiTool as AppTool,
        [manageWebhooksTool.name]: manageWebhooksTool as AppTool,
        [cacheManagementTool.name]: cacheManagementTool as AppTool,
        [realtimeManagementTool.name]: realtimeManagementTool as AppTool,
        [environmentManagementTool.name]: environmentManagementTool as AppTool,
        [smartMigrationTool.name]: smartMigrationTool as AppTool,
        [metricsDashboardTool.name]: metricsDashboardTool as AppTool,
    };

    // Prepare capabilities
    const capabilitiesTools: Record<string, McpToolSchema> = {};
    for (const tool of Object.values(availableTools)) {
        const staticInputSchema = tool.mcpInputSchema || { type: 'object', properties: {} };
        capabilitiesTools[tool.name] = {
            name: tool.name,
            description: tool.description || 'Tool description missing',
            inputSchema: staticInputSchema,
        };
    }

    const capabilities = { tools: capabilitiesTools };

    // Create MCP Server
    const server = new Server(
        {
            name: 'selfhosted-supabase-mcp',
            version: '2.0.0',
        },
        {
            capabilities,
        },
    );

    // Register handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: Object.values(capabilities.tools),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const requestId = `${Date.now()}-${Math.random()}`;
        const clientId = 'default';
        
        // Check rate limit
        const { allowed, retryAfter } = await rateLimiter.checkLimit(clientId);
        if (!allowed) {
            throw new McpError(
                ErrorCode.InvalidRequest, 
                `Rate limit exceeded. Please retry after ${retryAfter} seconds.`
            );
        }
        
        // Check concurrency limit
        const canProceed = await concurrencyLimiter.acquire(clientId, requestId);
        if (!canProceed) {
            throw new McpError(
                ErrorCode.InvalidRequest,
                'Too many concurrent requests. Please try again later.'
            );
        }
        
        try {
            const tool = availableTools[toolName as keyof typeof availableTools];

            if (!tool) {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
            }
            if (typeof tool.execute !== 'function') {
                throw new Error(`Tool ${toolName} does not have an execute method.`);
            }

            let parsedArgs = request.params.arguments;
            if (tool.inputSchema && typeof tool.inputSchema.parse === 'function') {
                parsedArgs = (tool.inputSchema as z.ZodTypeAny).parse(request.params.arguments);
            }

            const context: ToolContext = {
                selfhostedClient,
                workspacePath: process.cwd(),
                log: (message, level = 'info') => {
                    console.error(`[${level.toUpperCase()}] ${message}`);
                }
            };

            let result;
            if (toolName === 'execute_sql' || toolName === 'apply_migration') {
                if (parsedArgs && typeof parsedArgs === 'object' && 'sql' in parsedArgs) {
                    const sql = (parsedArgs as any).sql;
                    if (typeof sql === 'string') {
                        try {
                            queryAnalyzer.checkComplexityLimit(sql, 100);
                        } catch (error) {
                            throw new McpError(
                                ErrorCode.InvalidRequest,
                                `Query too complex: ${error instanceof Error ? error.message : 'Unknown error'}`
                            );
                        }
                    }
                }
                
                result = await withResourceLimits(
                    () => tool.execute(parsedArgs as any, context),
                    { maxExecutionTimeMs: 30000, maxMemoryMB: 256 }
                );
            } else {
                result = await tool.execute(parsedArgs as any, context);
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error: unknown) {
             console.error(`Error executing tool ${toolName}:`, error);
             let errorMessage = `Error executing tool ${toolName}: `;
             if (error instanceof z.ZodError) {
                 errorMessage += `Input validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
             } else if (error instanceof Error) {
                 errorMessage += error.message;
             } else {
                 errorMessage += String(error);
             }
             return {
                content: [{ type: 'text', text: errorMessage }],
                isError: true,
             };
        } finally {
            concurrencyLimiter.release(clientId, requestId);
        }
    });

    // Return the server instance
    return {
        server,
        // Provide a connect method
        async connect() {
            const transport = new StdioServerTransport();
            await server.connect(transport);
            console.error('MCP Server connected to stdio.');
        }
    };
}

// For standalone execution (keeping backward compatibility)
export async function startStandaloneServer(options: any) {
    const config: Config = {
        supabaseUrl: options.url,
        supabaseAnonKey: options.anonKey,
        supabaseServiceRoleKey: options.serviceKey,
        databaseUrl: options.dbUrl,
        supabaseAuthJwtSecret: options.jwtSecret,
    };
    
    const { connect } = await createServer(config);
    await connect();
}