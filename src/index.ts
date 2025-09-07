#!/usr/bin/env node

/**
 * Point d'entrée TypeScript pour Smithery CLI
 * Ce fichier permet à Smithery de construire le projet et appelle le serveur Python
 */

import { spawn } from 'child_process';
import { join } from 'path';

// Configuration du serveur Python
const PYTHON_SERVER_PATH = join(__dirname, 'src', 'supabase_server.py');

console.log('🚀 Démarrage du serveur Supabase MCP OAuth2 v3.1.0...');
console.log(`📁 Chemin du serveur Python: ${PYTHON_SERVER_PATH}`);

// Démarrer le serveur Python
const pythonProcess = spawn('python', [PYTHON_SERVER_PATH], {
  stdio: 'inherit',
  cwd: process.cwd()
});

pythonProcess.on('error', (error) => {
  console.error('❌ Erreur lors du démarrage du serveur Python:', error.message);
  process.exit(1);
});

pythonProcess.on('exit', (code) => {
  console.log(`🔄 Serveur Python terminé avec le code: ${code}`);
  process.exit(code || 0);
});

// Gestion des signaux pour arrêter proprement
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  pythonProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur...');
  pythonProcess.kill('SIGTERM');
});