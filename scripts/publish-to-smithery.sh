#!/bin/bash

# Script de publication automatique sur Smithery
# Utilise la clé API conservée pour automatiser le processus

echo "🚀 Publication automatique sur Smithery..."

# Charger la configuration Smithery
if [ -f "smithery-config.env" ]; then
    source smithery-config.env
    echo "🔑 Clé API Smithery chargée automatiquement"
else
    echo "❌ Fichier de configuration smithery-config.env non trouvé"
    exit 1
fi

# Vérifier si smithery est installé
if ! command -v smithery &> /dev/null; then
    echo "❌ Erreur: Smithery CLI n'est pas installé"
    echo "💡 Installez-le avec: npm install -g @smithery/cli"
    exit 1
fi

# Connexion automatique avec la clé API
echo "🔑 Connexion automatique à Smithery..."
if [ -n "$SMITHERY_API_KEY" ]; then
    echo "$SMITHERY_API_KEY" | smithery login --api-key 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Connexion automatique réussie"
    else
        echo "❌ Échec de la connexion automatique"
        exit 1
    fi
else
    echo "❌ Clé API non définie"
    exit 1
fi

# Construire le projet
echo "🔨 Construction du projet..."
if smithery build; then
    echo "✅ Construction réussie"
else
    echo "❌ Erreur lors de la construction"
    exit 1
fi

# Tentative de publication
echo "📤 Tentative de publication..."
if smithery publish 2>/dev/null; then
    echo "✅ Publication réussie !"
elif smithery deploy 2>/dev/null; then
    echo "✅ Déploiement réussi !"
elif smithery push 2>/dev/null; then
    echo "✅ Push réussi !"
else
    echo "⚠️  Commande de publication non disponible dans cette version"
    echo "💡 Le projet est construit et prêt pour la publication manuelle"
    echo "🌐 Visitez: https://smithery.ai/ pour publier manuellement"
    echo "📁 Fichier de build: .smithery/index.cjs"
fi

echo "🎉 Processus terminé !"
