#!/bin/bash
# Diagnostic final Railway

echo "🔍 Diagnostic final Railway"
echo "==========================="
echo ""

echo "📋 Informations actuelles:"
echo "=========================="
echo "Dockerfile actuel:"
cat Dockerfile
echo ""

echo "📁 Fichiers présents:"
ls -la *.py
echo ""

echo "🚂 Statut Railway:"
railway status
echo ""

echo "🔧 Actions recommandées:"
echo "========================"
echo ""
echo "1. 🌐 Railway Dashboard:"
echo "   - Allez sur https://railway.app"
echo "   - Projet MCP > Service Supabase-MCP-SelfHosted"
echo "   - Settings > Service > Start Command: python main.py"
echo "   - Settings > Variables: PORT=8000"
echo ""
echo "2. 🔄 Redémarrage du service:"
echo "   - Railway Dashboard > Service > Restart"
echo "   - Ou utilisez: railway redeploy"
echo ""
echo "3. 📝 Vérification des logs:"
echo "   - Railway Dashboard > Service > Logs"
echo "   - Cherchez les erreurs de démarrage"
echo ""
echo "4. 🧪 Test manuel:"
echo "   - Une fois déployé, testez: curl https://mcp.coupaul.fr/health"
echo ""

echo "❌ Problème identifié:"
echo "======================"
echo "Railway n'arrive pas à démarrer le service correctement."
echo "Cela peut être dû à:"
echo "- Configuration Railway Dashboard incorrecte"
echo "- Variables d'environnement manquantes"
echo "- Problème de build Docker"
echo ""

echo "✅ Solution immédiate:"
echo "====================="
echo "1. Railway Dashboard > Settings > Service"
echo "2. Start Command: python main.py"
echo "3. Variables: PORT=8000, PYTHONUNBUFFERED=1"
echo "4. Restart le service"
echo ""

echo "🎯 Une fois corrigé, Railway devrait:"
echo "===================================="
echo "✅ Démarrer main.py"
echo "✅ Exposer le port 8000"
echo "✅ Répondre à /health"
echo "✅ Passer le healthcheck"
echo "✅ Être accessible sur mcp.coupaul.fr"
