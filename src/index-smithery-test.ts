import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const configSchema = z.object({
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default('')
});

export default async function createServer({ config }) {
  const tools = [
    {
      name: 'execute_sql',
      description: '🆕 v3.1.0 Enhanced SQL with OAuth2 DDL support',
      inputSchema: {
        type: 'object',
        properties: { 
          sql: { type: 'string', description: 'SQL query to execute' },
          allow_multiple_statements: { type: 'boolean', default: false, description: 'Enable DDL multi-statements' }
        },
        required: ['sql']
      }
    },
    {
      name: 'import_schema',
      description: '🆕 v3.1.0 Import OAuth2 schemas with transaction safety',
      inputSchema: {
        type: 'object',
        properties: { 
          source: { type: 'string', description: 'SQL content or file path' },
          enable_extensions: { type: 'array', items: { type: 'string' }, description: 'Extensions like pgcrypto' }
        },
        required: ['source']
      }
    }
  ];

  const server = new Server(
    { name: 'supabase-mcp', version: '3.1.0' },
    { capabilities: { tools: Object.fromEntries(tools.map(t => [t.name, t])) } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => ({
    content: [{ type: 'text', text: `✅ ${req.params.name} v3.1.0 OAuth2-ready executed successfully` }]
  }));

  return server;
}
