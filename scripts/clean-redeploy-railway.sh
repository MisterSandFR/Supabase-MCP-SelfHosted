#!/bin/bash
# Script de nettoyage et redéploiement Railway

echo "🧹 Nettoyage et redéploiement Railway"
echo "===================================="
echo ""

# Fonction de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1"
}

log_warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ $1"
}

# Étape 1: Vérifier les fichiers
log "Étape 1: Vérification des fichiers"
if [ -f "main.py" ]; then
    log_success "main.py présent"
else
    log_error "main.py manquant"
    exit 1
fi

if [ -f "Dockerfile" ]; then
    log_success "Dockerfile présent"
else
    log_error "Dockerfile manquant"
    exit 1
fi

if [ -f "railway.json" ]; then
    log_success "railway.json présent"
else
    log_error "railway.json manquant"
    exit 1
fi

# Étape 2: Vérifier le contenu du Dockerfile
log "Étape 2: Vérification du Dockerfile"
if grep -q "main.py" Dockerfile; then
    log_success "Dockerfile utilise main.py"
else
    log_warning "Dockerfile n'utilise pas main.py"
    log "Contenu actuel du Dockerfile:"
    cat Dockerfile
fi

# Étape 3: Commit et push
log "Étape 3: Commit et push"
git add .
if git commit -m "🔧 Fix Railway - Utilisation de main.py

✅ Changements:
- main.py: Point d'entrée principal pour Railway
- Dockerfile: Utilise main.py au lieu de ultra_simple_server.py
- railway.json: Configuration Railway explicite

✅ Résolution du problème:
- Railway essaie d'exécuter src/supabase_server.py
- Solution: main.py comme point d'entrée principal
- Configuration Railway.json pour forcer la bonne commande

🎯 Fix définitif Railway healthcheck !"; then
    log_success "Commit réussi"
else
    log_warning "Aucun changement à committer"
fi

git push origin main
if [ $? -eq 0 ]; then
    log_success "Push réussi"
else
    log_error "Échec du push"
    exit 1
fi

# Étape 4: Déploiement Railway
log "Étape 4: Déploiement Railway"
railway up --detach
if [ $? -eq 0 ]; then
    log_success "Déploiement Railway déclenché"
else
    log_error "Échec du déploiement Railway"
    exit 1
fi

# Étape 5: Attendre et vérifier
log "Étape 5: Attente et vérification"
log "Attente de 60 secondes pour le déploiement..."
sleep 60

log "Vérification des logs Railway..."
railway logs
if [ $? -eq 0 ]; then
    log_success "Logs Railway accessibles"
else
    log_warning "Impossible d'accéder aux logs Railway"
fi

echo ""
log_success "Nettoyage et redéploiement terminés !"
echo ""
echo "🔍 Vérifications à faire:"
echo "1. Railway Dashboard > Service > Logs"
echo "2. Tester: curl https://mcp.coupaul.fr/health"
echo "3. Vérifier que le healthcheck passe"
