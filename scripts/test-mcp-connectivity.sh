#!/bin/bash

# Script de test de connectivité pour le serveur MCP
# Teste la connectivité et diagnostique les problèmes de timeout

echo "🔍 Test de connectivité du serveur MCP..."

# Test de connectivité réseau de base
echo "🌐 Test de connectivité réseau..."
if ping -c 1 smithery.ai > /dev/null 2>&1; then
    echo "✅ Connectivité vers smithery.ai OK"
else
    echo "❌ Problème de connectivité vers smithery.ai"
fi

# Vérifier la configuration du serveur
echo ""
echo "🔧 Vérification de la configuration..."
if grep -q "SUPABASE_URL" src/supabase_server.py; then
    echo "✅ Configuration Supabase détectée"
else
    echo "❌ Configuration Supabase manquante"
fi

# Vérifier les outils MCP
echo ""
echo "🛠️ Vérification des outils MCP..."
tool_count=$(grep -c "@server.tool()" src/supabase_server.py)
echo "📊 Nombre d'outils détectés: $tool_count"

# Vérifier le build Smithery
echo ""
echo "🔨 Test du build Smithery..."
if npx smithery build > /dev/null 2>&1; then
    echo "✅ Build Smithery réussi"
else
    echo "❌ Erreur lors du build Smithery"
fi

# Suggestions spécifiques pour le timeout
echo ""
echo "💡 Solutions pour l'erreur de timeout MCP:"
echo ""
echo "1. 🔑 Configuration des clés API:"
echo "   - Vérifiez que SUPABASE_URL et SUPABASE_ANON_KEY sont configurés"
echo "   - Testez les clés API Supabase séparément"
echo ""
echo "2. 🌐 Connectivité réseau:"
echo "   - Vérifiez votre connexion internet"
echo "   - Testez l'accès à https://smithery.ai/"
echo "   - Vérifiez les pare-feu/proxy"
echo ""
echo "3. ⏱️ Timeout de connexion:"
echo "   - Augmentez le timeout dans votre client MCP"
echo "   - Vérifiez les logs du serveur sur Smithery"
echo "   - Testez avec un client MCP différent"
echo ""
echo "4. 🔧 Configuration du serveur:"
echo "   - Vérifiez que le serveur répond aux requêtes"
echo "   - Testez les outils MCP individuellement"
echo "   - Vérifiez les dépendances Python"

echo ""
echo "🎯 Prochaines étapes recommandées:"
echo "1. Vérifiez les logs sur https://smithery.ai/"
echo "2. Testez avec un client MCP simple"
echo "3. Vérifiez la configuration des clés API Supabase"
echo "4. Contactez le support Smithery si le problème persiste"

echo ""
echo "✅ Test de connectivité terminé !"
