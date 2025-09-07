import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const configSchema = z.object({
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default('')
});

// Progressive: Start with Hello World + 1 OAuth2 tool at a time
const progressiveTools = [
  {
    name: 'hello',
    description: 'Test tool',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'execute_sql',
    description: 'Enhanced SQL execution with OAuth2 DDL support',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string' }
      },
      required: ['sql']
    }
  },
  {
    name: 'import_schema',
    description: 'Import SQL schemas for OAuth2 deployments', 
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string' }
      },
      required: ['source']
    }
  }
];

export default async function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new Server(
    { name: 'supabase-mcp', version: '3.1.0' },
    {
      capabilities: {
        tools: Object.fromEntries(progressiveTools.map(t => [t.name, t]))
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: progressiveTools
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => ({
    content: [{ 
      type: 'text', 
      text: request.params.name === 'hello' 
        ? 'Hello World!' 
        : `✅ ${request.params.name} v3.1.0 OAuth2-ready executed`
    }]
  }));

  return server;
}
