#!/bin/bash

# Script de post-commit pour automatiser le push via Smithery CLI
# Ce script s'exécute automatiquement après chaque commit

echo "🚀 Démarrage du push automatique via Smithery CLI..."

# Vérifier si nous sommes dans un dépôt git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Erreur: Ce script doit être exécuté dans un dépôt git"
    exit 1
fi

# Vérifier si smithery est installé
if ! command -v smithery &> /dev/null; then
    echo "❌ Erreur: Smithery CLI n'est pas installé"
    echo "💡 Installez-le avec: npm install -g @smithery/cli"
    exit 1
fi

# Vérifier si l'utilisateur est connecté à Smithery
if ! smithery login --check 2>/dev/null; then
    echo "⚠️  Vous n'êtes pas connecté à Smithery"
    echo "🔑 Connectez-vous avec: smithery login"
    exit 1
fi

# Construire le projet avec Smithery
echo "🔨 Construction du projet avec Smithery..."
if smithery build; then
    echo "✅ Construction réussie"
else
    echo "❌ Erreur lors de la construction"
    exit 1
fi

# Push automatique (si disponible dans Smithery CLI)
echo "📤 Tentative de push automatique..."
if smithery push 2>/dev/null; then
    echo "✅ Push automatique réussi"
elif smithery deploy 2>/dev/null; then
    echo "✅ Déploiement automatique réussi"
else
    echo "⚠️  Commande de push non disponible dans cette version de Smithery"
    echo "💡 Vous devrez peut-être utiliser l'interface web de Smithery pour le déploiement"
fi

echo "🎉 Processus de post-commit terminé!"
