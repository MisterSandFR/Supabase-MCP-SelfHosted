#!/bin/bash

# Script de démarrage automatique pour auto-commit et push
# Ce script peut être exécuté au démarrage du système

echo "🚀 Démarrage du système d'auto-commit et push..."

# Vérifier si nous sommes dans un dépôt git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Erreur: Ce script doit être exécuté dans un dépôt git"
    exit 1
fi

# Vérifier si Node.js est installé
if ! command -v node > /dev/null 2>&1; then
    echo "❌ Erreur: Node.js n'est pas installé"
    echo "💡 Installez Node.js pour utiliser l'auto-commit"
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm > /dev/null 2>&1; then
    echo "❌ Erreur: npm n'est pas installé"
    exit 1
fi

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Fonction pour logger avec timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a logs/auto-commit.log
}

# Fonction de nettoyage à l'arrêt
cleanup() {
    log_with_timestamp "🛑 Arrêt du système d'auto-commit..."
    if [ ! -z "$WATCHER_PID" ]; then
        kill $WATCHER_PID 2>/dev/null
        log_with_timestamp "✅ Processus de surveillance arrêté"
    fi
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGINT SIGTERM

log_with_timestamp "✅ Démarrage du système d'auto-commit"

# Démarrer le watcher en arrière-plan
log_with_timestamp "👀 Démarrage de la surveillance des fichiers..."
node scripts/auto-commit-watcher.js > logs/watcher.log 2>&1 &
WATCHER_PID=$!

log_with_timestamp "✅ Système d'auto-commit démarré (PID: $WATCHER_PID)"
log_with_timestamp "📁 Surveillance active sur: src/, scripts/, package.json, etc."
log_with_timestamp "⏱️  Cooldown entre commits: 30 secondes"
log_with_timestamp "🛑 Appuyez sur Ctrl+C pour arrêter"

# Attendre indéfiniment
while true; do
    sleep 60
    # Vérifier si le processus est toujours actif
    if ! kill -0 $WATCHER_PID 2>/dev/null; then
        log_with_timestamp "❌ Le processus de surveillance s'est arrêté inattendu"
        log_with_timestamp "🔄 Redémarrage..."
        node scripts/auto-commit-watcher.js > logs/watcher.log 2>&1 &
        WATCHER_PID=$!
        log_with_timestamp "✅ Surveillance redémarrée (PID: $WATCHER_PID)"
    fi
done
