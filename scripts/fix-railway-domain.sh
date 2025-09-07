#!/bin/bash
# Script de correction du certificat HTTPS pour mcp.coupaul.fr
# Le problème: le certificat est configuré pour *.up.railway.app au lieu de mcp.coupaul.fr

echo "🔒 Correction du certificat HTTPS pour mcp.coupaul.fr"
echo "===================================================="
echo "Problème identifié: Certificat configuré pour *.up.railway.app"
echo "Solution: Configurer un domaine personnalisé sur Railway"
echo ""

# Fonction de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ $1"
}

log_warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ $1"
}

echo "🔍 Diagnostic du problème:"
echo "=========================="
echo "1. Le certificat SSL actuel est configuré pour: *.up.railway.app"
echo "2. Votre domaine mcp.coupaul.fr pointe vers: 66.33.22.103"
echo "3. Le serveur Railway utilise son certificat wildcard par défaut"
echo ""

echo "🔧 Solutions disponibles:"
echo "========================="
echo ""
echo "Option 1: 🌐 Configurer un domaine personnalisé sur Railway"
echo "----------------------------------------------------------"
echo "1. Connectez-vous à Railway Dashboard"
echo "2. Sélectionnez votre projet MCP"
echo "3. Allez dans Settings > Domains"
echo "4. Ajoutez le domaine: mcp.coupaul.fr"
echo "5. Railway générera automatiquement un certificat SSL pour ce domaine"
echo "6. Suivez les instructions DNS de Railway"
echo ""

echo "Option 2: 🔄 Utiliser le domaine Railway par défaut"
echo "--------------------------------------------------"
echo "1. Utilisez l'URL Railway: https://votre-projet.up.railway.app"
echo "2. Configurez une redirection DNS: mcp.coupaul.fr -> votre-projet.up.railway.app"
echo "3. Le certificat SSL fonctionnera immédiatement"
echo ""

echo "Option 3: 🛠️ Configuration manuelle avec Let's Encrypt"
echo "-----------------------------------------------------"
echo "1. Déployez sur un serveur VPS avec votre propre domaine"
echo "2. Utilisez le script setup-letsencrypt.sh"
echo "3. Configurez Nginx avec le certificat Let's Encrypt"
echo ""

echo "📋 Instructions détaillées pour Railway:"
echo "========================================"
echo ""
echo "1. 🌐 Ajouter le domaine personnalisé:"
echo "   - Railway Dashboard > Projet MCP > Settings > Domains"
echo "   - Cliquer sur 'Add Domain'"
echo "   - Entrer: mcp.coupaul.fr"
echo "   - Railway vous donnera des instructions DNS"
echo ""
echo "2. 🔗 Configurer les enregistrements DNS:"
echo "   - Type: CNAME"
echo "   - Nom: mcp"
echo "   - Valeur: [URL fournie par Railway]"
echo "   - TTL: 300 (5 minutes)"
echo ""
echo "3. ⏰ Attendre la validation:"
echo "   - Railway vérifiera automatiquement le domaine"
echo "   - Un certificat SSL sera généré automatiquement"
echo "   - Le processus peut prendre 5-15 minutes"
echo ""

echo "🧪 Test de la solution:"
echo "======================="
echo "Une fois configuré, testez avec:"
echo "curl -I https://mcp.coupaul.fr"
echo ""

echo "🔍 Vérification du certificat:"
echo "============================="
echo "Le certificat devrait montrer:"
echo "Subject Alternative Name: DNS:mcp.coupaul.fr"
echo "Au lieu de: DNS:*.up.railway.app"
echo ""

log_success "Instructions de correction fournies !"
echo ""
echo "💡 Recommandation: Utilisez l'Option 1 (domaine personnalisé Railway)"
echo "   C'est la solution la plus simple et la plus fiable."
