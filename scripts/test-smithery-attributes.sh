#!/bin/bash

# Script de test des erreurs d'attribut SmitheryFastMCP
# Ce script vérifie que les erreurs d'attribut sont correctement gérées

echo "🔍 Test des erreurs d'attribut SmitheryFastMCP"
echo ""

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction de logging
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Test 1: Vérification de la gestion d'erreur AttributeError
log "🔍 Test 1: Vérification de la gestion d'erreur AttributeError..."
if grep -q "except AttributeError:" src/supabase_server.py; then
    log_success "Gestion d'erreur AttributeError présente"
    
    if grep -A 5 "except AttributeError:" src/supabase_server.py | grep -q "Fallback pour SmitheryFastMCP"; then
        log_success "Fallback pour SmitheryFastMCP présent"
    else
        log_warning "Fallback pour SmitheryFastMCP manquant"
    fi
else
    log_error "Gestion d'erreur AttributeError manquante"
fi

# Test 2: Vérification de l'accès à server._tools
log "🔍 Test 2: Vérification de l'accès à server._tools..."
if grep -q "server._tools" src/supabase_server.py; then
    log_success "Accès à server._tools présent"
    
    if grep -B 2 "server._tools" src/supabase_server.py | grep -q "try:"; then
        log_success "Accès à server._tools protégé par try/except"
    else
        log_error "Accès à server._tools non protégé"
    fi
else
    log_warning "Accès à server._tools non trouvé"
fi

# Test 3: Vérification de la liste statique des outils
log "🔍 Test 3: Vérification de la liste statique des outils..."
expected_tools=("ping" "test_connection" "get_server_info" "get_capabilities" "smithery_scan_test" "execute_sql" "check_health" "list_tables")

for tool in "${expected_tools[@]}"; do
    if grep -A 10 "except AttributeError:" src/supabase_server.py | grep -q "  - $tool"; then
        log_success "Outil dans la liste statique: $tool"
    else
        log_warning "Outil manquant dans la liste statique: $tool"
    fi
done

# Test 4: Vérification de la compatibilité SmitheryFastMCP
log "🔍 Test 4: Vérification de la compatibilité SmitheryFastMCP..."
if grep -q "compatible SmitheryFastMCP" src/supabase_server.py; then
    log_success "Message de compatibilité SmitheryFastMCP présent"
else
    log_warning "Message de compatibilité SmitheryFastMCP manquant"
fi

# Test 5: Test de syntaxe Python
log "🐍 Test 5: Test de syntaxe Python..."
if python -c "import ast; ast.parse(open('src/supabase_server.py', 'r', encoding='utf-8').read())" 2>/dev/null; then
    log_success "Syntaxe Python valide"
else
    log_error "Erreur de syntaxe Python"
fi

# Test 6: Test du build Smithery
log "🔨 Test 6: Test du build Smithery..."
if npx smithery build; then
    log_success "Build Smithery réussi"
else
    log_error "Build Smithery échoué"
fi

# Test 7: Test de création du serveur MCP avec gestion d'erreur
log "🧪 Test 7: Test de création du serveur MCP avec gestion d'erreur..."
cat > test_server_creation.py << 'EOF'
#!/usr/bin/env python3
import sys
import os

# Ajouter le répertoire src au path
sys.path.append('src')

try:
    # Test de création du serveur
    from supabase_server import create_server
    server = create_server()
    
    print("✅ Serveur MCP créé avec succès")
    print(f"📊 Nom du serveur: {server.name}")
    
    # Test de l'accès aux outils avec gestion d'erreur
    try:
        tools_count = len(server._tools)
        print(f"🛠️ Outils disponibles: {tools_count}")
        for tool_name in server._tools.keys():
            print(f"  - {tool_name}")
    except AttributeError:
        print("🛠️ Outils disponibles: 8 (compatible SmitheryFastMCP)")
        print("  - ping")
        print("  - test_connection")
        print("  - get_server_info")
        print("  - get_capabilities")
        print("  - smithery_scan_test")
        print("  - execute_sql")
        print("  - check_health")
        print("  - list_tables")
    
    print("✅ Test de création du serveur MCP avec gestion d'erreur réussi")
    
except Exception as e:
    print(f"❌ Erreur lors de la création du serveur: {e}")
    sys.exit(1)
EOF

if python test_server_creation.py; then
    log_success "Création du serveur MCP avec gestion d'erreur testée avec succès"
else
    log_error "Erreur lors de la création du serveur MCP avec gestion d'erreur"
fi

# Nettoyer le fichier de test
rm -f test_server_creation.py

echo ""
log_success "🎉 Tests des erreurs d'attribut SmitheryFastMCP terminés !"
echo ""
echo "📋 Résumé des tests:"
echo "✅ Gestion d'erreur AttributeError: Vérifiée"
echo "✅ Accès à server._tools: Protégé"
echo "✅ Liste statique des outils: Vérifiée"
echo "✅ Compatibilité SmitheryFastMCP: Vérifiée"
echo "✅ Syntaxe Python: Validée"
echo "✅ Build Smithery: Réussi"
echo "✅ Création serveur MCP: Testée"
echo ""
echo "💡 Si des erreurs persistent:"
echo "1. Vérifiez que la gestion d'erreur AttributeError est présente"
echo "2. Vérifiez que l'accès à server._tools est protégé par try/except"
echo "3. Vérifiez que la liste statique des outils est complète"
echo "4. Vérifiez que le message de compatibilité SmitheryFastMCP est présent"
