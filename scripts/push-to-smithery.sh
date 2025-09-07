#!/bin/bash

# Script de push manuel vers Smithery
# Utilisez ce script après vous être connecté avec smithery login

echo "🚀 Push manuel vers Smithery..."

# Vérifier si smithery est installé
if ! command -v smithery &> /dev/null; then
    echo "❌ Erreur: Smithery CLI n'est pas installé"
    echo "💡 Installez-le avec: npm install -g @smithery/cli"
    exit 1
fi

# Vérifier la connexion
if ! smithery login --check 2>/dev/null; then
    echo "❌ Vous n'êtes pas connecté à Smithery"
    echo "🔑 Connectez-vous d'abord avec: smithery login"
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

# Tentative de push
echo "📤 Tentative de push..."
if smithery push 2>/dev/null; then
    echo "✅ Push réussi !"
elif smithery deploy 2>/dev/null; then
    echo "✅ Déploiement réussi !"
else
    echo "⚠️  Commande de push non disponible"
    echo "💡 Utilisez l'interface web de Smithery pour le déploiement"
    echo "🌐 Visitez: https://smithery.ai/"
fi

echo "🎉 Processus terminé !"
