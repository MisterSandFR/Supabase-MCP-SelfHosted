#!/bin/bash
# Test du serveur hybride MCP + HTTP

echo "🧪 Test du serveur hybride MCP + HTTP"
echo "======================================"

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

# Test 1: Vérifier que hybrid_server.py existe
log "Test 1: Vérification du fichier hybrid_server.py"
if [ -f "hybrid_server.py" ]; then
    log_success "hybrid_server.py trouvé"
else
    log_error "hybrid_server.py manquant"
    exit 1
fi

# Test 2: Vérifier la syntaxe Python
log "Test 2: Vérification de la syntaxe Python"
if python -c "import ast; ast.parse(open('hybrid_server.py', 'r', encoding='utf-8').read())" 2>/dev/null; then
    log_success "Syntaxe Python valide"
else
    log_error "Erreur de syntaxe Python"
    exit 1
fi

# Test 3: Vérifier les imports
log "Test 3: Vérification des imports Python"
if python -c "
import sys
sys.path.append('.')
try:
    from hybrid_server import create_server, start_http_server, HealthCheckHandler
    print('✅ Imports réussis')
except ImportError as e:
    print(f'❌ Erreur d\'import: {e}')
    sys.exit(1)
" 2>/dev/null; then
    log_success "Imports Python réussis"
else
    log_error "Erreur d'import Python"
    exit 1
fi

# Test 4: Test de démarrage du serveur (en arrière-plan)
log "Test 4: Test de démarrage du serveur hybride"
log "Démarrage du serveur en arrière-plan sur le port 8001..."

# Démarrer le serveur en arrière-plan sur un port différent
PORT=8001
python -c "
import os
os.environ['PORT'] = '8001'
from hybrid_server import start_http_server
start_http_server()
" &
SERVER_PID=$!

# Attendre que le serveur démarre
sleep 3

# Test 5: Test de l'endpoint /health
log "Test 5: Test de l'endpoint /health"
if curl -s "http://localhost:8001/health" | grep -q "UP"; then
    log_success "Endpoint /health fonctionnel"
else
    log_error "Endpoint /health non fonctionnel"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test 6: Test de l'endpoint /
log "Test 6: Test de l'endpoint /"
if curl -s "http://localhost:8001/" | grep -q "Supabase MCP Hybrid Server"; then
    log_success "Endpoint / fonctionnel"
else
    log_error "Endpoint / non fonctionnel"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test 7: Test de l'endpoint 404
log "Test 7: Test de l'endpoint 404"
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8001/nonexistent" | grep -q "404"; then
    log_success "Gestion des erreurs 404 fonctionnelle"
else
    log_error "Gestion des erreurs 404 non fonctionnelle"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Arrêter le serveur de test
log "Arrêt du serveur de test..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

# Test 8: Vérifier le Dockerfile
log "Test 8: Vérification du Dockerfile"
if grep -q "hybrid_server.py" Dockerfile; then
    log_success "Dockerfile utilise hybrid_server.py"
else
    log_error "Dockerfile n'utilise pas hybrid_server.py"
    exit 1
fi

if grep -q "EXPOSE 8000" Dockerfile; then
    log_success "Dockerfile expose le port 8000"
else
    log_error "Dockerfile n'expose pas le port 8000"
    exit 1
fi

# Test 9: Test de build Smithery
log "Test 9: Test de build Smithery"
if npx smithery build > /dev/null 2>&1; then
    log_success "Build Smithery réussi"
else
    log_error "Build Smithery échoué"
    exit 1
fi

echo ""
log_success "🎉 Tous les tests du serveur hybride sont réussis !"
echo ""
echo "📊 Résumé des tests:"
echo "✅ Fichier hybrid_server.py présent"
echo "✅ Syntaxe Python valide"
echo "✅ Imports Python réussis"
echo "✅ Serveur HTTP démarre correctement"
echo "✅ Endpoint /health fonctionnel"
echo "✅ Endpoint / fonctionnel"
echo "✅ Gestion des erreurs 404"
echo "✅ Dockerfile configuré correctement"
echo "✅ Build Smithery réussi"
echo ""
echo "🚀 Le serveur hybride MCP + HTTP est prêt pour Railway !"
