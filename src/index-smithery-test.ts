import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const configSchema = z.object({
  SUPABASE_URL: z.string().default('')
});

export default async function createServer({ config }) {
  const server = new Server(
    { name: 'supabase-mcp', version: '3.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
      name: 'hello',
      description: 'Hello World',
      inputSchema: { type: 'object', properties: {} }
    }]
  }));

  server.setRequestHandler(CallToolRequestSchema, async () => ({
    content: [{ type: 'text', text: 'Hello OAuth2 v3.1.0!' }]
  }));

  return server;
}
