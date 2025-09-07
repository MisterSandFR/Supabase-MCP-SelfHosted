#!/bin/bash
# Script de diagnostic et correction Railway healthcheck

echo "🚂 Diagnostic et correction Railway healthcheck"
echo "=============================================="
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

# Test 1: Vérifier le statut Railway
log "Test 1: Vérification du statut Railway"
if railway status 2>/dev/null | grep -q "Project:"; then
    log_success "Railway connecté"
    railway status
else
    log_error "Railway non connecté ou service non lié"
    echo "Tentative de connexion..."
    railway login
fi

# Test 2: Vérifier les fichiers nécessaires
log "Test 2: Vérification des fichiers nécessaires"
if [ -f "ultra_simple_server.py" ]; then
    log_success "ultra_simple_server.py présent"
else
    log_error "ultra_simple_server.py manquant"
    exit 1
fi

if [ -f "Dockerfile" ]; then
    log_success "Dockerfile présent"
else
    log_error "Dockerfile manquant"
    exit 1
fi

# Test 3: Vérifier la syntaxe Python
log "Test 3: Vérification de la syntaxe Python"
if python3 -c "import ast; ast.parse(open('ultra_simple_server.py', 'r', encoding='utf-8').read())" 2>/dev/null; then
    log_success "Syntaxe Python valide"
else
    log_warning "Impossible de vérifier la syntaxe Python localement"
fi

# Test 4: Créer un Dockerfile ultra-simple
log "Test 4: Création d'un Dockerfile ultra-simple"
cat > Dockerfile.ultra << 'EOF'
FROM python:3.12-slim
WORKDIR /app
COPY ultra_simple_server.py .
EXPOSE 8000
CMD ["python", "ultra_simple_server.py"]
EOF

log_success "Dockerfile ultra-simple créé"

# Test 5: Tester le build local (si Docker disponible)
log "Test 5: Test du build Docker local"
if command -v docker >/dev/null 2>&1; then
    log "Test du build Docker..."
    if docker build -f Dockerfile.ultra -t test-server . >/dev/null 2>&1; then
        log_success "Build Docker local réussi"
        
        # Test du serveur en arrière-plan
        log "Test du serveur en arrière-plan..."
        docker run -d -p 8001:8000 --name test-server test-server >/dev/null 2>&1
        sleep 3
        
        if curl -s "http://localhost:8001/health" | grep -q "UP"; then
            log_success "Serveur HTTP fonctionne localement"
        else
            log_warning "Serveur HTTP ne répond pas localement"
        fi
        
        # Nettoyer
        docker stop test-server >/dev/null 2>&1
        docker rm test-server >/dev/null 2>&1
    else
        log_warning "Build Docker local échoué"
    fi
else
    log_warning "Docker non disponible pour test local"
fi

echo ""
echo "🔧 Solutions recommandées:"
echo "=========================="
echo ""
echo "1. 🚀 Utiliser le Dockerfile ultra-simple"
echo "   - Copier Dockerfile.ultra vers Dockerfile"
echo "   - Déployer avec Railway"
echo ""
echo "2. 🔄 Redémarrer le service Railway"
echo "   - Railway Dashboard > Service > Restart"
echo "   - Ou utiliser: railway redeploy"
echo ""
echo "3. 📝 Vérifier les logs Railway"
echo "   - Railway Dashboard > Service > Logs"
echo "   - Chercher les erreurs de démarrage"
echo ""
echo "4. 🌐 Tester manuellement"
echo "   - Déployer le serveur ultra-simple"
echo "   - Tester l'endpoint /health"
echo ""

# Proposer de remplacer le Dockerfile
echo "🔄 Voulez-vous remplacer le Dockerfile par la version ultra-simple ?"
echo "Cela devrait résoudre le problème de healthcheck Railway."
echo ""
echo "Commande: cp Dockerfile.ultra Dockerfile"
echo "Puis: git add . && git commit -m 'Fix Railway healthcheck' && git push"

log_success "Diagnostic terminé !"
