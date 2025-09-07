import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export default function createServer() {
  const server = new Server(
    { name: 'supabase-mcp', version: '3.1.0' },
    {
      capabilities: {
        tools: {
          execute_sql: {
            name: 'execute_sql',
            description: '🆕 v3.1 Enhanced SQL with OAuth2 DDL support',
            inputSchema: {
              type: 'object',
              properties: { sql: { type: 'string' } },
              required: ['sql']
            }
          },
          import_schema: {
            name: 'import_schema', 
            description: '🆕 v3.1 Import OAuth2 schemas',
            inputSchema: {
              type: 'object',
              properties: { source: { type: 'string' } },
              required: ['source']
            }
          },
          list_tables: {
            name: 'list_tables',
            description: 'List tables',
            inputSchema: { type: 'object', properties: {} }
          }
        }
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'execute_sql',
        description: '🆕 v3.1 Enhanced SQL with OAuth2 DDL support',
        inputSchema: {
          type: 'object',
          properties: { sql: { type: 'string' } },
          required: ['sql']
        }
      },
      {
        name: 'import_schema',
        description: '🆕 v3.1 Import OAuth2 schemas',
        inputSchema: {
          type: 'object',
          properties: { source: { type: 'string' } },
          required: ['source']
        }
      },
      {
        name: 'list_tables',
        description: 'List tables',
        inputSchema: { type: 'object', properties: {} }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => ({
    content: [{ type: 'text', text: `✅ ${req.params.name} OAuth2-ready` }]
  }));

  return server;
}
