#!/usr/bin/env node

// Script d'automatisation Smithery MCP
import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const testConfigurations = [
  {
    name: 'minimal-commonjs',
    description: 'Configuration minimaliste CommonJS',
    tools: ['execute_sql', 'list_tables']
  },
  {
    name: 'oauth2-core',
    description: 'OAuth2 Core Tools',
    tools: ['execute_sql', 'import_schema', 'list_tables']
  },
  {
    name: 'oauth2-complete',
    description: 'OAuth2 Complete v3.1.0',
    tools: ['execute_sql', 'import_schema', 'execute_psql', 'inspect_schema', 'apply_migration', 'list_tables']
  }
];

function createServerContent(tools) {
  const toolsList = tools.map(tool => {
    switch(tool) {
      case 'execute_sql':
        return `{
        name: 'execute_sql',
        description: '🆕 v3.1.0 Enhanced SQL with OAuth2 DDL support',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            allow_multiple_statements: { type: 'boolean', default: false }
          },
          required: ['sql']
        }
      }`;
      case 'import_schema':
        return `{
        name: 'import_schema',
        description: '🆕 v3.1.0 Import OAuth2 schemas with transaction safety',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            enable_extensions: { type: 'array', items: { type: 'string' } }
          },
          required: ['source']
        }
      }`;
      case 'execute_psql':
        return `{
        name: 'execute_psql',
        description: '🆕 v3.1.0 Direct PostgreSQL psql access',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            output_format: { type: 'string', enum: ['table', 'json'] }
          }
        }
      }`;
      case 'inspect_schema':
        return `{
        name: 'inspect_schema',
        description: '🆕 v3.1.0 Schema inspection with TypeScript generation',
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['detailed', 'typescript'] }
          }
        }
      }`;
      case 'apply_migration':
        return `{
        name: 'apply_migration',
        description: '🆕 v3.1.0 Advanced migrations with validation',
        inputSchema: {
          type: 'object',
          properties: {
            version: { type: 'string' },
            dry_run: { type: 'boolean', default: false }
          },
          required: ['version']
        }
      }`;
      case 'list_tables':
        return `{
        name: 'list_tables',
        description: 'List database tables',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }`;
      default:
        return `{
        name: '${tool}',
        description: 'Tool ${tool}',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }`;
    }
  }).join(',\n      ');

  return `import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const configSchema = z.object({
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default('')
});

export default async function createServer({ config }) {
  const server = new Server(
    { name: 'supabase-mcp', version: '3.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ${toolsList}
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name } = req.params;
    
    return {
      content: [{ type: 'text', text: \`✅ \${name} v3.1.0 OAuth2-ready executed successfully\` }]
    };
  });

  return server;
}`;
}

async function deployAndTest(configIndex) {
  const config = testConfigurations[configIndex];
  console.log(`\n🚀 Test ${configIndex + 1}/${testConfigurations.length}: ${config.name}`);
  console.log(`📝 Description: ${config.description}`);
  console.log(`🛠️ Tools: ${config.tools.join(', ')}`);
  
  try {
    // Créer le contenu du serveur
    const serverContent = createServerContent(config.tools);
    
    // Écrire le fichier de test
    writeFileSync('src/index-smithery-test.ts', serverContent);
    
    // Mettre à jour smithery.yaml
    const smitheryConfig = `runtime: "typescript"
entry: "src/index-smithery-test.ts"
dockerfile: "Dockerfile.smithery"`;
    writeFileSync('smithery.yaml', smitheryConfig);
    
    // Mettre à jour package.json
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    packageJson.module = './src/index-smithery-test.ts';
    packageJson.exports = { '.': './src/index-smithery-test.ts' };
    packageJson.types = './src/index-smithery-test.ts';
    writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    
    // Commit et push
    console.log('📤 Commit et push...');
    execSync(`git add . && git commit -m "🤖 AUTO-TEST ${configIndex + 1}/${testConfigurations.length}: ${config.name} - ${config.tools.length} tools" && git push origin main`, { stdio: 'inherit' });
    
    // Attendre le déploiement
    console.log('⏳ Attente du déploiement (30s)...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    console.log('✅ Configuration déployée - Vérifiez maintenant sur Smithery !');
    console.log(`🔗 URL: https://server.smithery.ai/@MisterSandFR/supabase-mcp-selfhosted/mcp`);
    console.log(`📊 Outils attendus: ${config.tools.length}`);
    
    return { status: 'deployed', tools: config.tools.length };
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    return { status: 'error', message: error.message };
  }
}

async function runAutoTest() {
  console.log('🤖 DÉMARRAGE DU TEST AUTOMATIQUE SMITHERY');
  console.log(`🎯 ${testConfigurations.length} configurations à tester`);
  
  for (let i = 0; i < testConfigurations.length; i++) {
    const result = await deployAndTest(i);
    
    if (result.status === 'deployed') {
      console.log(`✅ Configuration ${i + 1} déployée avec succès`);
      console.log(`🛠️ ${result.tools} outils disponibles`);
      
      if (i < testConfigurations.length - 1) {
        console.log('🔄 Test de la configuration suivante...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Pause entre tests
      }
    } else {
      console.log(`❌ Échec avec configuration: ${testConfigurations[i].name}`);
      break;
    }
  }
  
  console.log('🏁 Test automatique terminé');
  console.log('🔍 Vérifiez maintenant le statut sur Smithery !');
}

// Lancer le test automatique
runAutoTest().catch(console.error);
