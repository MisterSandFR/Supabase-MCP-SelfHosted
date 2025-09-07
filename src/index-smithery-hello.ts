import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const configSchema = z.object({
  SUPABASE_URL: z.string().default('')
});

export default async function createServer({ config }: { config: z.infer<typeof configSchema> }) {
  const server = new Server(
    { name: 'hello-mcp', version: '1.0.0' },
    {
      capabilities: {
        tools: {
          hello: {
            name: 'hello',
            description: 'Say hello',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        }
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
      name: 'hello',
      description: 'Say hello',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }]
  }));

  server.setRequestHandler(CallToolRequestSchema, async () => ({
    content: [{ type: 'text', text: 'Hello World!' }]
  }));

  return server;
}
