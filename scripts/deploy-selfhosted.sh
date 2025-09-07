#!/bin/bash

# Script de déploiement Self-Hosted pour Supabase MCP Server

echo "🚀 Déploiement Self-Hosted Supabase MCP Server"

# Variables de configuration
IMAGE_NAME="supabase-mcp-server"
CONTAINER_NAME="supabase-mcp"
PORT="3000"

# Vérification des variables d'environnement
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Erreur: SUPABASE_URL et SUPABASE_ANON_KEY sont requis"
    echo "💡 Exemple:"
    echo "   export SUPABASE_URL='https://your-project.supabase.co'"
    echo "   export SUPABASE_ANON_KEY='your-anon-key'"
    exit 1
fi

echo "📡 Supabase URL: $SUPABASE_URL"
echo "🔑 Anon Key: ${SUPABASE_ANON_KEY:0:20}..."

# Construction de l'image Docker
echo "🔨 Construction de l'image Docker..."
docker build -t $IMAGE_NAME .

if [ $? -eq 0 ]; then
    echo "✅ Image construite avec succès"
else
    echo "❌ Erreur lors de la construction"
    exit 1
fi

# Arrêt du conteneur existant
echo "🛑 Arrêt du conteneur existant..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Démarrage du nouveau conteneur
echo "🚀 Démarrage du serveur..."
docker run -d \
    --name $CONTAINER_NAME \
    -p $PORT:3000 \
    -e SUPABASE_URL="$SUPABASE_URL" \
    -e SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
    -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
    -e DATABASE_URL="$DATABASE_URL" \
    $IMAGE_NAME

if [ $? -eq 0 ]; then
    echo "✅ Serveur démarré avec succès"
    echo "🌐 URL: http://localhost:$PORT"
    echo "🔍 Logs: docker logs $CONTAINER_NAME"
    echo "🛑 Arrêt: docker stop $CONTAINER_NAME"
    
    # Test de santé
    echo "🏥 Test de santé..."
    sleep 5
    curl -f http://localhost:$PORT/health && echo "✅ Serveur opérationnel" || echo "⚠️ Serveur en cours de démarrage"
else
    echo "❌ Erreur lors du démarrage"
    exit 1
fi
