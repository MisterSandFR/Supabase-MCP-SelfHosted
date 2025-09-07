// Script de test automatique avec vérification Smithery
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const SMITHERY_URL = 'https://server.smithery.ai/@MisterSandFR/supabase-mcp-selfhosted/mcp';
const MAX_ITERATIONS = 10;

// Configurations de test progressives
const testConfigurations = [
  {
    name: 'minimal-hello',
    description: 'Test Hello World minimal',
    content: `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
}`
  },
  
  {
    name: 'oauth2-basic',
    description: 'Test avec execute_sql OAuth2',
    content: `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
      description: 'Enhanced SQL with OAuth2 DDL support',
      inputSchema: {
        type: 'object',
        properties: { sql: { type: 'string' } },
        required: ['sql']
      }
    }
  ];

  const server = new Server(
    { name: 'supabase-mcp', version: '3.1.0' },
    { capabilities: { tools: Object.fromEntries(tools.map(t => [t.name, t])) } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => ({
    content: [{ type: 'text', text: \`✅ \${req.params.name} OAuth2-ready\` }]
  }));

  return server;
}`
  },
  
  {
    name: 'oauth2-complete',
    description: 'Test avec tous les outils OAuth2 v3.1.0',
    content: `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
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
      description: 'Enhanced SQL with OAuth2 DDL support',
      inputSchema: {
        type: 'object',
        properties: { 
          sql: { type: 'string' },
          allow_multiple_statements: { type: 'boolean', default: false }
        },
        required: ['sql']
      }
    },
    {
      name: 'import_schema',
      description: 'Import OAuth2 schemas with extensions',
      inputSchema: {
        type: 'object',
        properties: { 
          source: { type: 'string' },
          enable_extensions: { type: 'array', items: { type: 'string' } }
        },
        required: ['source']
      }
    },
    {
      name: 'execute_psql',
      description: 'Direct PostgreSQL access',
      inputSchema: {
        type: 'object',
        properties: { 
          command: { type: 'string' },
          output_format: { type: 'string', enum: ['table', 'json'] }
        }
      }
    },
    {
      name: 'inspect_schema',
      description: 'Schema inspection with TypeScript',
      inputSchema: {
        type: 'object',
        properties: { 
          format: { type: 'string', enum: ['detailed', 'typescript'] }
        }
      }
    },
    {
      name: 'apply_migration',
      description: 'Advanced migrations with validation',
      inputSchema: {
        type: 'object',
        properties: { 
          version: { type: 'string' },
          dry_run: { type: 'boolean' }
        },
        required: ['version']
      }
    }
  ];

  const server = new Server(
    { name: 'supabase-mcp', version: '3.1.0' },
    { capabilities: { tools: Object.fromEntries(tools.map(t => [t.name, t])) } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => ({
    content: [{ type: 'text', text: \`✅ \${req.params.name} v3.1.0 OAuth2-ready\` }]
  }));

  return server;
}`
  }
];

async function checkSmitheryStatus() {
  try {
    console.log('🔍 Vérification du statut Smithery...');
    
    // Simulation de vérification - en réalité on devrait faire un fetch
    // const response = await fetch(SMITHERY_URL);
    // return response.ok;
    
    // Pour l'instant, on simule
    return { status: 'unknown', message: 'Vérification manuelle requise' };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    return { status: 'error', message: error.message };
  }
}

async function deployAndTest(configIndex) {
  const config = testConfigurations[configIndex];
  console.log(`\n🚀 Test ${configIndex + 1}/${testConfigurations.length}: ${config.name}`);
  console.log(`📝 Description: ${config.description}`);
  
  try {
    // Écrire le fichier de test
    writeFileSync('src/index-smithery-test.ts', config.content);
    
    // Mettre à jour smithery.yaml
    const smitheryConfig = \`runtime: "typescript"
entry: "src/index-smithery-test.ts"
dockerfile: "Dockerfile.smithery"\`;
    writeFileSync('smithery.yaml', smitheryConfig);
    
    // Commit et push
    console.log('📤 Commit et push...');
    execSync('git add . && git commit -m "🧪 Auto-test: ' + config.name + '" && git push origin main', { stdio: 'inherit' });
    
    // Attendre un peu pour le déploiement
    console.log('⏳ Attente du déploiement (30s)...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Vérifier le statut
    const status = await checkSmitheryStatus();
    console.log('📊 Statut:', status);
    
    return status;
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    return { status: 'error', message: error.message };
  }
}

async function runAutoTest() {
  console.log('🤖 DÉMARRAGE DU TEST AUTOMATIQUE SMITHERY');
  console.log(\`🎯 \${testConfigurations.length} configurations à tester\`);
  
  for (let i = 0; i < testConfigurations.length; i++) {
    const result = await deployAndTest(i);
    
    if (result.status === 'success') {
      console.log(\`✅ SUCCÈS avec configuration: \${testConfigurations[i].name}\`);
      console.log('🎉 Solution trouvée ! Arrêt du test automatique.');
      break;
    } else {
      console.log(\`❌ Échec avec configuration: \${testConfigurations[i].name}\`);
      if (i < testConfigurations.length - 1) {
        console.log('🔄 Test de la configuration suivante...');
      }
    }
  }
  
  console.log('🏁 Test automatique terminé');
}

// Lancer le test automatique
runAutoTest().catch(console.error);
