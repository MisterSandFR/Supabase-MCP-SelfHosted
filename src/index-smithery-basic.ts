import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const configSchema = z.object({
    SUPABASE_URL: z.string().optional().default(''),
    SUPABASE_ANON_KEY: z.string().optional().default('')
});

// Just 3 basic tools to test
const basicTools = [
    {
        name: "execute_sql",
        description: "Enhanced SQL execution with OAuth2 support",
        inputSchema: {
            type: "object",
            properties: {
                sql: { type: "string" }
            },
            required: ["sql"]
        }
    },
    {
        name: "import_schema", 
        description: "Import SQL schemas for OAuth2",
        inputSchema: {
            type: "object",
            properties: {
                source: { type: "string" }
            },
            required: ["source"]
        }
    },
    {
        name: "list_tables",
        description: "List database tables",
        inputSchema: {
            type: "object",
            properties: {}
        }
    }
];

export default function createServer({ config }: { config: z.infer<typeof configSchema> } = { config: { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } }) {
    console.log('🔧 BASIC: Creating server...');
    
    const server = new Server(
        { name: 'supabase-mcp', version: '3.1.0' },
        { capabilities: { tools: Object.fromEntries(basicTools.map(t => [t.name, t])) } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.log('🔧 BASIC: Listing tools');
        return { tools: basicTools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        console.log(`🔧 BASIC: ${request.params.name} called`);
        return {
            content: [{ type: 'text', text: `Tool ${request.params.name} works!` }]
        };
    });
    
    console.log('🔧 BASIC: Server ready');
    return server;
}
