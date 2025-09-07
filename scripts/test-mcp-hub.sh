#!/bin/bash
# Test du MCP Hub

echo "🧪 Test du MCP Hub"
echo "=================="
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

# Test 1: Vérifier les fichiers
log "Test 1: Vérification des fichiers"
if [ -f "mcp_hub.py" ]; then
    log_success "mcp_hub.py présent"
else
    log_error "mcp_hub.py manquant"
    exit 1
fi

if [ -f "src/supabase_server.py" ]; then
    log_success "src/supabase_server.py présent"
else
    log_error "src/supabase_server.py manquant"
    exit 1
fi

# Test 2: Test de démarrage du hub (en arrière-plan)
log "Test 2: Test de démarrage du MCP Hub"
log "Démarrage du hub en arrière-plan sur le port 8003..."

# Démarrer le hub en arrière-plan
PORT=8003 python mcp_hub.py &
HUB_PID=$!

# Attendre que le hub démarre
sleep 3

# Test 3: Test de l'endpoint /health
log "Test 3: Test de l'endpoint /health"
if curl -s "http://localhost:8003/health" | grep -q "UP"; then
    log_success "Endpoint /health fonctionnel"
else
    log_error "Endpoint /health non fonctionnel"
    kill $HUB_PID 2>/dev/null
    exit 1
fi

# Test 4: Test de l'endpoint /mcp
log "Test 4: Test de l'endpoint /mcp"
if curl -s "http://localhost:8003/mcp" | grep -q "Supabase MCP"; then
    log_success "Endpoint /mcp fonctionnel"
else
    log_error "Endpoint /mcp non fonctionnel"
    kill $HUB_PID 2>/dev/null
    exit 1
fi

# Test 5: Test de l'endpoint /api/servers
log "Test 5: Test de l'endpoint /api/servers"
if curl -s "http://localhost:8003/api/servers" | grep -q "supabase-mcp"; then
    log_success "Endpoint /api/servers fonctionnel"
else
    log_error "Endpoint /api/servers non fonctionnel"
    kill $HUB_PID 2>/dev/null
    exit 1
fi

# Test 6: Test de l'endpoint /api/tools
log "Test 6: Test de l'endpoint /api/tools"
if curl -s "http://localhost:8003/api/tools" | grep -q "ping"; then
    log_success "Endpoint /api/tools fonctionnel"
else
    log_error "Endpoint /api/tools non fonctionnel"
    kill $HUB_PID 2>/dev/null
    exit 1
fi

# Test 7: Test de la page hub principale
log "Test 7: Test de la page hub principale"
if curl -s "http://localhost:8003/" | grep -q "MCP Hub"; then
    log_success "Page hub principale fonctionnelle"
else
    log_error "Page hub principale non fonctionnelle"
    kill $HUB_PID 2>/dev/null
    exit 1
fi

# Arrêter le hub de test
log "Arrêt du hub de test..."
kill $HUB_PID 2>/dev/null
wait $HUB_PID 2>/dev/null

# Test 8: Vérifier le Dockerfile
log "Test 8: Vérification du Dockerfile"
if grep -q "mcp_hub.py" Dockerfile; then
    log_success "Dockerfile utilise mcp_hub.py"
else
    log_error "Dockerfile n'utilise pas mcp_hub.py"
    exit 1
fi

echo ""
log_success "🎉 Tous les tests du MCP Hub sont réussis !"
echo ""
echo "📊 Résumé des tests:"
echo "✅ Fichier mcp_hub.py présent"
echo "✅ Fichier src/supabase_server.py présent"
echo "✅ Hub démarre correctement"
echo "✅ Endpoint /health fonctionnel"
echo "✅ Endpoint /mcp fonctionnel (compatible Smithery)"
echo "✅ Endpoint /api/servers fonctionnel"
echo "✅ Endpoint /api/tools fonctionnel"
echo "✅ Page hub principale fonctionnelle"
echo "✅ Dockerfile configuré correctement"
echo ""
echo "🚀 Le MCP Hub est prêt pour Railway !"
echo "🌐 Une fois déployé, accessible sur: https://mcp.coupaul.fr"
echo "🔗 Endpoint MCP pour Smithery: https://mcp.coupaul.fr/mcp"
