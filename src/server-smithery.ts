import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
import type { ToolContext, AppTool } from './tools/types.js';
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
import { RateLimiter, ConcurrencyLimiter, QueryComplexityAnalyzer, withResourceLimits } from './utils/rate-limiter.js';

interface Config {
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey?: string;
    databaseUrl?: string;
    supabaseAuthJwtSecret?: string;
}

// Create server specifically for Smithery
export async function createSmitheryServer(config: Config) {
    // Handle placeholder/empty config for initial scan
    if (!config.supabaseUrl || config.supabaseUrl === '' || 
        !config.supabaseAnonKey || config.supabaseAnonKey === '' ||
        config.supabaseUrl === 'string' || // Smithery sometimes sends literal 'string'
        !config.supabaseUrl.startsWith('http')) { // Must be a valid URL
        
        // Return a minimal server that provides schema information
        const server = new Server({
            name: 'selfhosted-supabase-mcp',
            version: '2.1.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        
        // Return the server directly
        return server;
    }

    // Initialize rate limiters
    const rateLimiter = new RateLimiter(100, 60000);
    const concurrencyLimiter = new ConcurrencyLimiter(10);
    const queryAnalyzer = new QueryComplexityAnalyzer();
    
    // Try to create Supabase client
    let selfhostedClient;
    try {
        selfhostedClient = await SelfhostedSupabaseClient.create({
            supabaseUrl: config.supabaseUrl,
            supabaseAnonKey: config.supabaseAnonKey,
            supabaseServiceRoleKey: config.supabaseServiceRoleKey,
            jwtSecret: config.supabaseAuthJwtSecret,
            databaseUrl: config.databaseUrl,
        });
    } catch (error) {
        console.error('Failed to create Supabase client:', error);
        // Return a minimal server on error
        const server = new Server({
            name: 'selfhosted-supabase-mcp',
            version: '2.1.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        return server;
    }

    // Prepare the tools
    

    

    const availableTools: Record<string, AppTool> = {
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
        [listTablesTool.name]: listTablesTool,
        [listExtensionsTool.name]: listExtensionsTool,
        [listMigrationsTool.name]: listMigrationsTool,
        [applyMigrationTool.name]: applyMigrationTool,
        [executeSqlTool.name]: executeSqlTool,
        [getDatabaseConnectionsTool.name]: getDatabaseConnectionsTool,
        [getDatabaseStatsTool.name]: getDatabaseStatsTool,
        [getProjectUrlTool.name]: getProjectUrlTool,
        [getAnonKeyTool.name]: getAnonKeyTool,
        [getServiceKeyTool.name]: getServiceKeyTool,
        [generateTypesTool.name]: generateTypesTool,
        [rebuildHooksTool.name]: rebuildHooksTool,
        [verifyJwtSecretTool.name]: verifyJwtSecretTool,
        [listAuthUsersTool.name]: listAuthUsersTool,
        [getAuthUserTool.name]: getAuthUserTool,
        [deleteAuthUserTool.name]: deleteAuthUserTool,
        [createAuthUserTool.name]: createAuthUserTool,
        [updateAuthUserTool.name]: updateAuthUserTool,
        [listStorageBucketsTool.name]: listStorageBucketsTool,
        [listStorageObjectsTool.name]: listStorageObjectsTool,
        [listRealtimePublicationsTool.name]: listRealtimePublicationsTool,
        [getLogsTool.name]: getLogsTool,
        [checkHealthTool.name]: checkHealthTool,
        [backupDatabaseTool.name]: backupDatabaseTool,
        [manageDockerTool.name]: manageDockerTool,
        [analyzePerformanceTool.name]: analyzePerformanceTool,
        [validateMigrationTool.name]: validateMigrationTool,
        [pushMigrationsTool.name]: pushMigrationsTool,
        [createMigrationTool.name]: createMigrationTool,
        [manageDockerTool.name]: manageDockerTool as AppTool,
        [analyzePerformanceTool.name]: analyzePerformanceTool as AppTool,
        [validateMigrationTool.name]: validateMigrationTool as AppTool,
        [pushMigrationsTool.name]: pushMigrationsTool as AppTool,
        [createMigrationTool.name]: createMigrationTool as AppTool,
    };

    // Prepare capabilities
    const capabilitiesTools: Record<string, AppTool> = {};
    for (const tool of Object.values(availableTools)) {
        const staticInputSchema = tool.mcpInputSchema || { type: 'object', properties: {} };
        capabilitiesTools[tool.name] = {
            name: tool.name,
            description: tool.description || 'Tool description missing',
            inputSchema: tool.inputSchema,
            mcpInputSchema: staticInputSchema,
            outputSchema: tool.outputSchema,
            execute: tool.execute,
        };
    }

    const capabilities = { tools: capabilitiesTools };

    // Create MCP Server
    const server = new Server(
        {
            name: 'selfhosted-supabase-mcp',
            version: '2.1.0',
        },
        {
            capabilities,
        }
    );

    // Create context that will be shared across tool executions
    const context: ToolContext = {
        selfhostedClient: selfhostedClient,
        log: console.error,
        supabase: selfhostedClient.supabase,
        pg: selfhostedClient.getPgPool(),
        config: {
            url: config.supabaseUrl,
            anonKey: config.supabaseAnonKey,
            serviceKey: config.supabaseServiceRoleKey,
            jwtSecret: config.supabaseAuthJwtSecret,
            dbUrl: config.databaseUrl,
            workspacePath: process.cwd()
        }
    };

    // Request handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: Object.values(capabilitiesTools),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name: toolName, arguments: args } = request.params;
        const tool = availableTools[toolName];
        
        if (!tool) {
            throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${toolName}`);
        }

        // Rate limiting
        const clientId = 'smithery-client';
        const requestId = `${Date.now()}-${Math.random()}`;
        
        if (!rateLimiter.checkLimit(clientId)) {
            throw new McpError(
                ErrorCode.InvalidRequest,
                'Rate limit exceeded. Please wait before making more requests.'
            );
        }

        // Concurrency limiting
        if (!concurrencyLimiter.acquire(clientId, requestId)) {
            throw new McpError(
                ErrorCode.InvalidRequest,
                'Too many concurrent requests. Please wait for current operations to complete.'
            );
        }

        try {
            // Parse and validate input
            const parsedArgs = args && typeof args === 'object' && Object.keys(args).length > 0 ? args : {};
            
            let result;
            if (toolName === 'execute_sql') {
                result = await withResourceLimits(
                    () => tool.execute(parsedArgs as any, context),
                    { maxMemory: 256 * 1024 * 1024, maxTime: 30000 }
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

    // Return the server directly for Smithery
    return server;
}