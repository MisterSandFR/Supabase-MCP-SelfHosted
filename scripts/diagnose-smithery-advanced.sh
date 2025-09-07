#!/bin/bash

# Script de diagnostic avancé pour Smithery MCP
# Diagnostique les problèmes de connectivité et de scan

echo "🔍 Diagnostic avancé Smithery MCP..."

# Vérifier la configuration du serveur
echo "🔧 Vérification de la configuration du serveur..."
if grep -q "@smithery.server" src/supabase_server.py; then
    echo "✅ Décorateur @smithery.server trouvé"
else
    echo "❌ Décorateur @smithery.server manquant"
fi

if grep -q "def create_server" src/supabase_server.py; then
    echo "✅ Fonction create_server trouvée"
else
    echo "❌ Fonction create_server manquante"
fi

# Compter les outils
tool_count=$(grep -c "@server.tool()" src/supabase_server.py)
echo "📊 Nombre d'outils détectés: $tool_count"

# Vérifier les dépendances
echo ""
echo "📦 Vérification des dépendances..."
if grep -q "mcp.server.fastmcp" src/supabase_server.py; then
    echo "✅ Import FastMCP trouvé"
else
    echo "❌ Import FastMCP manquant"
fi

if grep -q "smithery.decorators" src/supabase_server.py; then
    echo "✅ Import Smithery trouvé"
else
    echo "❌ Import Smithery manquant"
fi

# Vérifier la configuration pyproject.toml
echo ""
echo "⚙️ Vérification de la configuration pyproject.toml..."
if grep -q "\[tool.smithery\]" pyproject.toml; then
    echo "✅ Configuration [tool.smithery] trouvée"
    grep -A 2 "\[tool.smithery\]" pyproject.toml
else
    echo "❌ Configuration [tool.smithery] manquante"
fi

# Test du build
echo ""
echo "🔨 Test du build Smithery..."
if npx smithery build > /dev/null 2>&1; then
    echo "✅ Build Smithery réussi"
else
    echo "❌ Erreur lors du build Smithery"
fi

# Vérifier les logs
echo ""
echo "📊 Vérification des logs..."
if [ -d ".smithery" ]; then
    echo "✅ Dossier .smithery trouvé"
    ls -la .smithery/
else
    echo "❌ Dossier .smithery manquant"
fi

# Suggestions pour résoudre "failed to fetch"
echo ""
echo "💡 Solutions pour 'failed to fetch':"
echo ""
echo "1. 🔑 Configuration des clés API:"
echo "   - Vérifiez que SUPABASE_URL et SUPABASE_ANON_KEY sont configurés"
echo "   - Les clés doivent être valides et actives"
echo ""
echo "2. 🌐 Connectivité réseau:"
echo "   - Vérifiez votre connexion internet"
echo "   - Testez l'accès à https://smithery.ai/"
echo "   - Vérifiez les pare-feu/proxy"
echo ""
echo "3. ⚙️ Configuration du serveur:"
echo "   - Le serveur doit répondre aux requêtes MCP"
echo "   - Vérifiez que tous les outils sont correctement définis"
echo "   - Testez avec un client MCP simple"
echo ""
echo "4. 🔧 Déploiement Smithery:"
echo "   - Vérifiez les logs sur https://smithery.ai/"
echo "   - Assurez-vous que le déploiement est complet"
echo "   - Testez la connectivité du serveur déployé"

echo ""
echo "🎯 Prochaines étapes recommandées:"
echo "1. Vérifiez les logs sur https://smithery.ai/"
echo "2. Testez avec un client MCP simple"
echo "3. Vérifiez la configuration des clés API Supabase"
echo "4. Contactez le support Smithery si le problème persiste"

echo ""
echo "✅ Diagnostic avancé terminé !"
