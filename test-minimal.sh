#!/bin/bash
# Test du serveur minimal

echo "🧪 Test du serveur minimal"
echo "========================="

# Test 1: Vérifier que minimal_server.py existe
if [ -f "minimal_server.py" ]; then
    echo "✅ minimal_server.py trouvé"
else
    echo "❌ minimal_server.py manquant"
    exit 1
fi

# Test 2: Test de démarrage du serveur (en arrière-plan)
echo "Démarrage du serveur en arrière-plan sur le port 8002..."

# Démarrer le serveur en arrière-plan
PORT=8002 python minimal_server.py &
SERVER_PID=$!

# Attendre que le serveur démarre
sleep 2

# Test 3: Test de l'endpoint /health
echo "Test de l'endpoint /health..."
if curl -s "http://localhost:8002/health" | grep -q "UP"; then
    echo "✅ Endpoint /health fonctionnel"
else
    echo "❌ Endpoint /health non fonctionnel"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test 4: Test de l'endpoint /
echo "Test de l'endpoint /..."
if curl -s "http://localhost:8002/" | grep -q "Supabase MCP Server"; then
    echo "✅ Endpoint / fonctionnel"
else
    echo "❌ Endpoint / non fonctionnel"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Arrêter le serveur de test
echo "Arrêt du serveur de test..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "✅ Tous les tests du serveur minimal sont réussis !"
echo "🚀 Le serveur minimal est prêt pour Railway !"
