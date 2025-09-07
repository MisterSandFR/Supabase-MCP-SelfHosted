import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import type { ToolContext, AppTool } from "./tools/types.js";

// Import only working tools to ensure Smithery compatibility
import { listTablesTool } from './tools/list_tables.js';
import { executeSqlTool } from './tools/execute_sql.js';
import { applyMigrationTool } from './tools/apply_migration.js';
import { getProjectUrlTool } from './tools/get_project_url.js';
import { getAnonKeyTool } from './tools/get_anon_key.js';
import { getServiceKeyTool } from './tools/get_service_key.js';
import { generateTypesTool } from './tools/generate_typescript_types.js';
import { listAuthUsersTool } from './tools/list_auth_users.js';
import { getAuthUserTool } from './tools/get_auth_user.js';
import { createAuthUserTool } from './tools/create_auth_user.js';
import { updateAuthUserTool } from './tools/update_auth_user.js';
import { deleteAuthUserTool } from './tools/delete_auth_user.js';
import { listStorageBucketsTool } from './tools/list_storage_buckets.js';
import { listStorageObjectsTool } from './tools/list_storage_objects.js';
import { checkHealthTool } from './tools/check_health.js';
// NEW v3.1.0 tools - our enhanced tools that work
import { importSchemaTool } from './tools/import_schema.js';
import { executePsqlTool } from './tools/execute_psql.js';
import { inspectSchemaTool } from './tools/inspect_schema.js';

function loadWorkingTools(): Record<string, AppTool> {
    return {
        // Core database operations
        [listTablesTool.name]: listTablesTool,
        [executeSqlTool.name]: executeSqlTool,
        [applyMigrationTool.name]: applyMigrationTool,
        
        // Project management
        [getProjectUrlTool.name]: getProjectUrlTool,
        [getAnonKeyTool.name]: getAnonKeyTool,
        [getServiceKeyTool.name]: getServiceKeyTool,
        [generateTypesTool.name]: generateTypesTool,
        
        // Auth management
        [listAuthUsersTool.name]: listAuthUsersTool,
        [getAuthUserTool.name]: getAuthUserTool,
        [createAuthUserTool.name]: createAuthUserTool,
        [updateAuthUserTool.name]: updateAuthUserTool,
        [deleteAuthUserTool.name]: deleteAuthUserTool,
        
        // Storage management
        [listStorageBucketsTool.name]: listStorageBucketsTool,
        [listStorageObjectsTool.name]: listStorageObjectsTool,
        
        // System health
        [checkHealthTool.name]: checkHealthTool,
        
        // NEW v3.1.0 Enhanced Tools - OAuth2 & DDL Support
        [importSchemaTool.name]: importSchemaTool,
        [executePsqlTool.name]: executePsqlTool,
        [inspectSchemaTool.name]: inspectSchemaTool,
    };
}

// Configuration schema for Smithery
export const configSchema = z.object({
    SUPABASE_URL: z.string().optional().default('').describe('Your Supabase project URL (required for operation)'),
    SUPABASE_ANON_KEY: z.string().optional().default('').describe('Supabase anonymous key (required for operation)'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().describe('Supabase service role key (optional, enables admin operations)'),
    DATABASE_URL: z.string().optional().describe('Direct database connection string (optional)'),
    SUPABASE_AUTH_JWT_SECRET: z.string().optional().describe('Supabase JWT secret (optional)')
});

// Export default async function for Smithery
export default async function createServer({ config }: { config: z.infer<typeof configSchema> } = { config: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }) {
    // Collect working tools only
    const availableTools = loadWorkingTools();

    console.log(`🔍 Smithery: Loaded ${Object.keys(availableTools).length} working tools`);
    console.log(`🔧 Tools: ${Object.keys(availableTools).join(', ')}`);

    // Prepare capabilities
    const capabilitiesTools: Record<string, any> = {};
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
            version: '3.1.0',
        },
        {
            capabilities,
        },
    );

    // Register handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: Object.values(capabilities.tools),
    }));

    server.setRequestHandler(CallToolRequestSchema,
        async (request) => {
            const toolName = request.params.name;
            const tool = availableTools[toolName];

            if (!tool) {
                throw new Error(`Tool ${toolName} not found`);
            }

            try {
                // Create a minimal context for tools that need it
                const context: ToolContext = {
                    selfhostedClient: null as any, // Will be initialized when needed
                };

                const result = await tool.execute(request.params.arguments || {}, context);
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                console.error(`Error executing tool ${toolName}:`, error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    console.log(`🚀 Smithery: Server created with ${Object.keys(availableTools).length} tools`);
    return server;
}
