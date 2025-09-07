#!/usr/bin/env node

/**
 * Script de surveillance automatique pour commit et push
 * Surveille les changements de fichiers et effectue automatiquement commit + push
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutoCommitWatcher {
    constructor() {
        this.watchPaths = [
            'src/',
            'scripts/',
            'package.json',
            'tsconfig.json',
            'smithery.yaml',
            'README.md',
            'requirements.txt',
            'pyproject.toml'
        ];
        this.ignorePatterns = [
            /node_modules/,
            /\.git/,
            /\.smithery/,
            /dist/,
            /\.DS_Store/,
            /\.log$/,
            /\.tmp$/
        ];
        this.lastCommitTime = 0;
        this.commitCooldown = 30000; // 30 secondes entre les commits
        this.isProcessing = false;
    }

    shouldIgnore(filePath) {
        return this.ignorePatterns.some(pattern => pattern.test(filePath));
    }

    async commitAndPush() {
        if (this.isProcessing) {
            console.log('⏳ Commit en cours, ignoré...');
            return;
        }

        const now = Date.now();
        if (now - this.lastCommitTime < this.commitCooldown) {
            console.log('⏳ Trop tôt pour un nouveau commit...');
            return;
        }

        this.isProcessing = true;
        this.lastCommitTime = now;

        try {
            console.log('🔄 Auto-commit et push en cours...');
            
            // Vérifier s'il y a des changements
            const status = execSync('git status --porcelain', { encoding: 'utf8' });
            if (!status.trim()) {
                console.log('✅ Aucun changement détecté');
                return;
            }

            // Ajouter tous les fichiers
            execSync('git add .', { stdio: 'inherit' });

            // Créer le commit avec timestamp
            const timestamp = new Date().toLocaleString('fr-FR');
            const commitMessage = `🤖 Auto-commit: ${timestamp}`;
            execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

            // Push vers origin
            execSync('git push origin main', { stdio: 'inherit' });

            console.log('✅ Auto-commit et push réussis !');

            // Build Smithery après push
            console.log('🔨 Build Smithery...');
            try {
                execSync('npx smithery build', { stdio: 'inherit' });
                console.log('✅ Build Smithery réussi !');
            } catch (error) {
                console.log('⚠️ Erreur build Smithery:', error.message);
            }

        } catch (error) {
            console.error('❌ Erreur lors du commit/push:', error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    startWatching() {
        console.log('👀 Surveillance automatique démarrée...');
        console.log('📁 Dossiers surveillés:', this.watchPaths.join(', '));
        console.log('⏱️  Cooldown entre commits:', this.commitCooldown / 1000, 'secondes');
        console.log('🛑 Appuyez sur Ctrl+C pour arrêter\n');

        this.watchPaths.forEach(watchPath => {
            if (fs.existsSync(watchPath)) {
                fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
                    if (filename && !this.shouldIgnore(filename)) {
                        console.log(`📝 Changement détecté: ${filename}`);
                        setTimeout(() => this.commitAndPush(), 2000); // Délai de 2 secondes
                    }
                });
                console.log(`✅ Surveillance activée pour: ${watchPath}`);
            }
        });
    }
}

// Gestion des signaux pour arrêt propre
process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt de la surveillance automatique...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Arrêt de la surveillance automatique...');
    process.exit(0);
});

// Démarrer la surveillance
const watcher = new AutoCommitWatcher();
watcher.startWatching();
