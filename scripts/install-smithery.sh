#!/bin/bash

# Script d'installation pour la configuration Smithery Auto-Push
# Ce script configure tout l'environnement nécessaire

echo "🔧 Installation de la configuration Smithery Auto-Push..."

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    echo "💡 Installez Node.js depuis https://nodejs.org/"
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi

# Installer Smithery CLI globalement
echo "📦 Installation de Smithery CLI..."
if npm install -g @smithery/cli; then
    echo "✅ Smithery CLI installé avec succès"
else
    echo "❌ Erreur lors de l'installation de Smithery CLI"
    exit 1
fi

# Vérifier l'installation
if command -v smithery &> /dev/null; then
    echo "✅ Smithery CLI est maintenant disponible"
    smithery --version
else
    echo "❌ Smithery CLI n'est pas accessible"
    exit 1
fi

# Instructions pour la connexion
echo ""
echo "🎉 Installation terminée !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Connectez-vous à Smithery : smithery login"
echo "2. Testez la configuration : git commit -m 'test'"
echo ""
echo "🚀 Le push automatique sera actif après la connexion !"
