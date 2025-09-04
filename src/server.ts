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
import type { ToolContext } from './tools/types.js';
import { RateLimiter, ConcurrencyLimiter, QueryComplexityAnalyzer, withResourceLimits } from './utils/rate-limiter.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

// --- DYNAMIC TOOL LOADING ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadTools(): Promise<Record<string, AppTool>> {
    const toolsDir = path.join(__dirname, 'tools');
    const toolFiles = fs.readdirSync(toolsDir).filter(file => 
        file.endsWith('.ts') && !file.endsWith('.d.ts') && file !== 'types.ts' && file !== 'utils.ts'
    );

    const tools: Record<string, AppTool> = {};
    for (const file of toolFiles) {
        // Important: Adjust the path for dynamic import to be relative and use the .js extension
        const modulePath = `./tools/${file.replace('.ts', '.js')}`;
        try {
            const module = await import(modulePath);
            // Find the first exported object that looks like a tool
            const toolObject = Object.values(module).find(
                (exp: any) => exp && typeof exp === 'object' && 'name' in exp && 'execute' in exp
            ) as AppTool | undefined;
            
            if (toolObject) {
                tools[toolObject.name] = toolObject;
            } else {
                console.error(`Warning: No valid tool export found in ${file}`);
            }
        } catch (error) {
            console.error(`Error loading tool from ${file}:`, error);
        }
    }
    return tools;
}
// --- END DYNAMIC TOOL LOADING ---

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

    const availableTools = await loadTools();
    if (process.env.NODE_ENV !== 'production') {
        console.error(`Loaded ${Object.keys(availableTools).length} tools dynamically.`);
    }

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
            version: '3.0.0',
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