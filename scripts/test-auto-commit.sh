#!/bin/bash

# Script de test pour le système d'auto-commit
# Ce script simule des changements pour tester l'automatisation

echo "🧪 Test du système d'auto-commit..."

# Créer un fichier de test
echo "# Test Auto-Commit $(date)" > test-auto-commit.md
echo "Ce fichier est créé pour tester le système d'auto-commit." >> test-auto-commit.md
echo "Il sera automatiquement committé et poussé." >> test-auto-commit.md

echo "✅ Fichier de test créé: test-auto-commit.md"
echo "👀 Le système devrait détecter ce changement et committer automatiquement..."
echo "⏱️  Attendez 30 secondes pour voir le commit automatique"

# Attendre un peu pour voir le résultat
sleep 5

# Vérifier le statut git
echo "📊 Statut Git actuel:"
git status --short

echo ""
echo "🎯 Pour tester manuellement:"
echo "   npm run auto-push    # Commit et push immédiat"
echo "   npm run watch        # Surveillance continue"
echo "   npm run full-auto    # Commit + push + build Smithery"
