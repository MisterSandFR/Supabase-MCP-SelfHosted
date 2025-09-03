import { Command } from 'commander';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
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
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolContext } from './tools/types.js';
import listStorageBucketsTool from './tools/list_storage_buckets.js';
import listStorageObjectsTool from './tools/list_storage_objects.js';
import listRealtimePublicationsTool from './tools/list_realtime_publications.js';
import { RateLimiter, ConcurrencyLimiter, QueryComplexityAnalyzer, withResourceLimits } from './utils/rate-limiter.js';
import { createInputValidator } from './utils/input-validator.js';

// Node.js built-in modules
import * as fs from 'node:fs';
import * as path from 'node:path';

// Define the structure expected by MCP for tool definitions
interface McpToolSchema {
    name: string;
    description?: string;
    // inputSchema is the JSON Schema object for MCP capabilities
    inputSchema: object; 
}

// Base structure for our tool objects - For Reference
interface AppTool {
    name: string;
    description: string;
    inputSchema: z.ZodTypeAny; // Zod schema for parsing
    mcpInputSchema: object;    // Static JSON schema for MCP (Required)
    outputSchema: z.ZodTypeAny; // Zod schema for output (optional)
    execute: (input: unknown, context: ToolContext) => Promise<unknown>;
}

// Initialize rate limiters
const rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute
const concurrencyLimiter = new ConcurrencyLimiter(10); // Max 10 concurrent requests
const queryAnalyzer = new QueryComplexityAnalyzer();

// Main function
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
        .option('--tools-config <path>', 'Path to a JSON file specifying which tools to enable (e.g., { "enabledTools": ["tool1", "tool2"] }). If omitted, all tools are enabled.')
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

    console.error('Initializing Self-Hosted Supabase MCP Server...');

    try {
        const selfhostedClient = await SelfhostedSupabaseClient.create({
            supabaseUrl: options.url,
            supabaseAnonKey: options.anonKey,
            supabaseServiceRoleKey: options.serviceKey,
            databaseUrl: options.dbUrl,
            jwtSecret: options.jwtSecret,
        });

        console.error('Supabase client initialized successfully.');

        const availableTools = {
            // Cast here assumes tools will implement AppTool structure
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
        };

        // --- Tool Filtering Logic ---
        let registeredTools: Record<string, AppTool> = { ...availableTools }; // Start with all tools
        const toolsConfigPath = options.toolsConfig as string | undefined;
        let enabledToolNames: Set<string> | null = null; // Use Set for efficient lookup

        if (toolsConfigPath) {
            try {
                const resolvedPath = path.resolve(toolsConfigPath);
                console.error(`Attempting to load tool configuration from: ${resolvedPath}`);
                if (!fs.existsSync(resolvedPath)) {
                    throw new Error(`Tool configuration file not found at ${resolvedPath}`);
                }
                const configFileContent = fs.readFileSync(resolvedPath, 'utf-8');
                const configJson = JSON.parse(configFileContent);

                if (!configJson || typeof configJson !== 'object' || !Array.isArray(configJson.enabledTools)) {
                     throw new Error('Invalid config file format. Expected { "enabledTools": ["tool1", ...] }.');
                }

                // Validate that enabledTools contains only strings
                const toolNames = configJson.enabledTools as unknown[];
                if (!toolNames.every((name): name is string => typeof name === 'string')) {
                    throw new Error('Invalid config file content. "enabledTools" must be an array of strings.');
                }

                enabledToolNames = new Set(toolNames.map(name => name.trim()).filter(name => name.length > 0));

            } catch (error: unknown) {
                console.error(`Error loading or parsing tool config file '${toolsConfigPath}':`, error instanceof Error ? error.message : String(error));
                console.error('Falling back to enabling all tools due to config error.');
                enabledToolNames = null; // Reset to null to signify fallback
            }
        }

        if (enabledToolNames !== null) { // Check if we successfully got names from config
            console.error(`Whitelisting tools based on config: ${Array.from(enabledToolNames).join(', ')}`);

            registeredTools = {}; // Reset and add only whitelisted tools
            for (const toolName in availableTools) {
                if (enabledToolNames.has(toolName)) {
                    registeredTools[toolName] = availableTools[toolName];
                } else {
                    console.error(`Tool ${toolName} disabled (not in config whitelist).`);
                }
            }

            // Check if any tools specified in the config were not found in availableTools
            for (const requestedName of enabledToolNames) {
                if (!availableTools[requestedName]) {
                    console.warn(`Warning: Tool "${requestedName}" specified in config file not found.`);
                }
            }
        } else {
            console.error("No valid --tools-config specified or error loading config, enabling all available tools.");
            // registeredTools already defaults to all tools, so no action needed here
        }
        // --- End Tool Filtering Logic ---

        // Prepare capabilities for the Server constructor
        const capabilitiesTools: Record<string, McpToolSchema> = {};
        // Use the potentially filtered 'registeredTools' map
        for (const tool of Object.values(registeredTools)) {
            // Directly use mcpInputSchema - assumes it exists and is correct
            const staticInputSchema = tool.mcpInputSchema || { type: 'object', properties: {} };

            if (!tool.mcpInputSchema) { // Simple check if it was actually provided
                 console.error(`Tool ${tool.name} is missing mcpInputSchema. Using default empty schema.`);
            }

            capabilitiesTools[tool.name] = {
                name: tool.name,
                description: tool.description || 'Tool description missing',
                inputSchema: staticInputSchema,
            };
        }

        const capabilities = { tools: capabilitiesTools };

        console.error('Initializing MCP Server...');
        const server = new Server(
            {
                name: 'self-hosted-supabase-mcp',
                version: '1.0.0',
            },
            {
                capabilities,
            },
        );

        // The ListTools handler should return the array matching McpToolSchema structure
        server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: Object.values(capabilities.tools),
        }));

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            const requestId = `${Date.now()}-${Math.random()}`;
            const clientId = 'default'; // In production, extract from request context
            
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
                // Look up the tool in the filtered 'registeredTools' map
                const tool = registeredTools[toolName as keyof typeof registeredTools];

                if (!tool) {
                    // Check if it existed originally but was filtered out
                    if (availableTools[toolName as keyof typeof availableTools]) {
                         throw new McpError(ErrorCode.MethodNotFound, `Tool "${toolName}" is available but not enabled by the current server configuration.`);
                    }
                    // If the tool wasn't in the original list either, it's unknown
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
                }
                if (typeof tool.execute !== 'function') {
                    throw new Error(`Tool ${toolName} does not have an execute method.`);
                }

                let parsedArgs = request.params.arguments;
                // Still use Zod schema for internal validation before execution
                if (tool.inputSchema && typeof tool.inputSchema.parse === 'function') {
                    parsedArgs = (tool.inputSchema as z.ZodTypeAny).parse(request.params.arguments);
                }

                // Create the context object using the imported type
                const context: ToolContext = {
                    selfhostedClient,
                    workspacePath: options.workspacePath as string,
                    log: (message, level = 'info') => {
                        // Simple logger using console.error (consistent with existing logs)
                        console.error(`[${level.toUpperCase()}] ${message}`);
                    }
                };

                // Execute with resource limits for SQL tools
                let result;
                if (toolName === 'execute_sql' || toolName === 'apply_migration') {
                    // Check query complexity for SQL operations
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
                    
                    // Execute with resource limits
                    result = await withResourceLimits(
                        () => tool.execute(parsedArgs as any, context),
                        { maxExecutionTimeMs: 30000, maxMemoryMB: 256 }
                    );
                } else {
                    // Execute normally for non-SQL tools
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
                // Always release concurrency slot
                concurrencyLimiter.release(clientId, requestId);
            }
        });

        console.error('Starting MCP Server in stdio mode...');
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('MCP Server connected to stdio.');

    } catch (error) {
        console.error('Failed to initialize or start the MCP server:', error);
        throw error; // Rethrow to ensure the process exits non-zero if init fails
    }
}

main().catch((error) => {
    console.error('Unhandled error in main function:', error);
    process.exit(1); // Exit with error code
});