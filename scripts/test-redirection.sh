#!/bin/bash
# Test du serveur avec redirection

echo "🧪 Test du serveur avec redirection Railway"
echo "=========================================="
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
if [ -f "main.py" ]; then
    log_success "main.py présent"
else
    log_error "main.py manquant"
    exit 1
fi

if [ -f "src/supabase_server.py" ]; then
    log_success "src/supabase_server.py présent"
else
    log_error "src/supabase_server.py manquant"
    exit 1
fi

if [ -f "Dockerfile" ]; then
    log_success "Dockerfile présent"
else
    log_error "Dockerfile manquant"
    exit 1
fi

# Test 2: Vérifier le contenu du Dockerfile
log "Test 2: Vérification du Dockerfile"
if grep -q "main.py" Dockerfile && grep -q "src/supabase_server.py" Dockerfile; then
    log_success "Dockerfile copie les deux fichiers"
else
    log_error "Dockerfile ne copie pas les bons fichiers"
    log "Contenu du Dockerfile:"
    cat Dockerfile
fi

# Test 3: Test de la redirection (simulation)
log "Test 3: Test de la redirection"
log "Simulation: Railway exécute src/supabase_server.py"
log "src/supabase_server.py devrait rediriger vers main.py"

echo ""
echo "🔧 Configuration Railway Dashboard:"
echo "=================================="
echo "1. Start Command: python src/supabase_server.py"
echo "2. Ou laissez vide (utilise le CMD du Dockerfile)"
echo "3. Variables: PORT=8000, PYTHONUNBUFFERED=1"
echo ""

echo "🎯 Résultat attendu:"
echo "==================="
echo "✅ Railway exécute src/supabase_server.py"
echo "✅ src/supabase_server.py redirige vers main.py"
echo "✅ main.py démarre le serveur HTTP"
echo "✅ Endpoint /health fonctionne"
echo "✅ Healthcheck Railway passe"
echo ""

log_success "Test terminé !"
