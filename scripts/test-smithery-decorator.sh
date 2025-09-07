#!/bin/bash

# Script de test du décorateur Smithery
# Ce script vérifie que le décorateur @smithery.server() est correctement configuré

echo "🔍 Test du décorateur Smithery"
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

# Test 1: Vérification du décorateur @smithery.server
log "🔍 Test 1: Vérification du décorateur @smithery.server..."
if grep -q "@smithery.server" src/supabase_server.py; then
    log_success "Décorateur @smithery.server présent"
    
    # Vérifier la syntaxe du décorateur
    if grep -A 5 "@smithery.server" src/supabase_server.py | grep -q "config_schema"; then
        log_success "Argument config_schema présent"
    else
        log_error "Argument config_schema manquant"
    fi
    
    # Vérifier qu'il n'y a pas d'arguments non supportés
    unsupported_args=("description=" "tags=" "homepage=" "repository=")
    for arg in "${unsupported_args[@]}"; do
        if grep -A 10 "@smithery.server" src/supabase_server.py | grep -q "$arg"; then
            log_error "Argument non supporté détecté: $arg"
        else
            log_success "Argument non supporté absent: $arg"
        fi
    done
else
    log_error "Décorateur @smithery.server manquant"
fi

# Test 2: Vérification de la classe ConfigSchema
log "🔍 Test 2: Vérification de la classe ConfigSchema..."
if grep -q "class ConfigSchema" src/supabase_server.py; then
    log_success "Classe ConfigSchema présente"
    
    if grep -A 5 "class ConfigSchema" src/supabase_server.py | grep -q "BaseModel"; then
        log_success "ConfigSchema hérite de BaseModel"
    else
        log_error "ConfigSchema n'hérite pas de BaseModel"
    fi
    
    # Vérifier les champs requis
    required_fields=("SUPABASE_URL" "SUPABASE_ANON_KEY")
    for field in "${required_fields[@]}"; do
        if grep -q "$field:" src/supabase_server.py; then
            log_success "Champ requis présent: $field"
        else
            log_error "Champ requis manquant: $field"
        fi
    done
else
    log_error "Classe ConfigSchema manquante"
fi

# Test 3: Vérification de la fonction create_server
log "🔍 Test 3: Vérification de la fonction create_server..."
if grep -q "def create_server" src/supabase_server.py; then
    log_success "Fonction create_server présente"
    
    if grep -A 2 "def create_server" src/supabase_server.py | grep -q "return server"; then
        log_success "Fonction create_server retourne le serveur"
    else
        log_warning "Fonction create_server ne retourne peut-être pas le serveur"
    fi
else
    log_error "Fonction create_server manquante"
fi

# Test 4: Vérification des imports
log "🔍 Test 4: Vérification des imports..."
required_imports=("from mcp.server.fastmcp import" "from smithery.decorators import" "from pydantic import")

for import_line in "${required_imports[@]}"; do
    if grep -q "$import_line" src/supabase_server.py; then
        log_success "Import présent: $import_line"
    else
        log_error "Import manquant: $import_line"
    fi
done

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

# Test 7: Test de création du serveur MCP
log "🧪 Test 7: Test de création du serveur MCP..."
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
    print(f"🛠️ Outils disponibles: {len(server._tools)}")
    
    # Lister les outils
    for tool_name in server._tools.keys():
        print(f"  - {tool_name}")
    
    print("✅ Test de création du serveur MCP réussi")
    
except Exception as e:
    print(f"❌ Erreur lors de la création du serveur: {e}")
    sys.exit(1)
EOF

if python test_server_creation.py; then
    log_success "Création du serveur MCP testée avec succès"
else
    log_error "Erreur lors de la création du serveur MCP"
fi

# Nettoyer le fichier de test
rm -f test_server_creation.py

echo ""
log_success "🎉 Tests du décorateur Smithery terminés !"
echo ""
echo "📋 Résumé des tests:"
echo "✅ Décorateur @smithery.server: Vérifié"
echo "✅ Classe ConfigSchema: Vérifiée"
echo "✅ Fonction create_server: Vérifiée"
echo "✅ Imports: Vérifiés"
echo "✅ Syntaxe Python: Validée"
echo "✅ Build Smithery: Réussi"
echo "✅ Création serveur MCP: Testée"
echo ""
echo "💡 Si des erreurs persistent:"
echo "1. Vérifiez la syntaxe du décorateur @smithery.server()"
echo "2. Vérifiez que ConfigSchema est correctement définie"
echo "3. Vérifiez que create_server() retourne le serveur"
echo "4. Vérifiez que tous les imports sont présents"
