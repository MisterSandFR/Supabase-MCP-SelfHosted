#!/bin/bash

# Script de diagnostic pour le serveur MCP Supabase
# Ce script teste la connectivité et diagnostique les problèmes de timeout

echo "🔍 Diagnostic du serveur MCP Supabase..."

# Vérifier les dépendances
echo "📦 Vérification des dépendances..."
if [ -f "pyproject.toml" ]; then
    echo "✅ pyproject.toml trouvé"
    grep -A 10 "\[tool.smithery\]" pyproject.toml
else
    echo "❌ pyproject.toml manquant"
fi

# Vérifier la configuration du serveur
echo ""
echo "🔧 Vérification de la configuration du serveur..."
if [ -f "src/supabase_server.py" ]; then
    echo "✅ src/supabase_server.py trouvé"
    echo "📋 Configuration détectée:"
    grep -n "@smithery.server" src/supabase_server.py
    grep -n "def create_server" src/supabase_server.py
else
    echo "❌ src/supabase_server.py manquant"
fi

# Vérifier les logs Smithery
echo ""
echo "📊 Vérification des logs Smithery..."
if [ -d ".smithery" ]; then
    echo "✅ Dossier .smithery trouvé"
    ls -la .smithery/
else
    echo "❌ Dossier .smithery manquant"
fi

# Suggestions de résolution
echo ""
echo "💡 Suggestions pour résoudre l'erreur de timeout:"
echo "1. Vérifiez que le serveur est bien déployé sur Smithery"
echo "2. Vérifiez les clés API Supabase dans la configuration"
echo "3. Testez la connectivité réseau"
echo "4. Vérifiez les logs du serveur sur Smithery"
echo "5. Assurez-vous que le serveur répond aux requêtes MCP"

echo ""
echo "🎯 Pour tester localement (si Python est installé):"
echo "   python src/supabase_server.py"
echo ""
echo "🎯 Pour vérifier le déploiement Smithery:"
echo "   npx smithery build"
echo "   # Puis vérifiez sur https://smithery.ai/"

echo ""
echo "✅ Diagnostic terminé !"
