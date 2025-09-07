#!/bin/bash

# Script de configuration Railway pour l'automatisation
# Ce script configure Railway pour le déploiement automatique

echo "🚂 Configuration Railway pour l'automatisation..."

# Vérifier la connexion Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Connexion Railway requise. Veuillez vous connecter avec 'railway login'"
    exit 1
fi

echo "✅ Connexion Railway vérifiée"

# Créer ou sélectionner le projet
echo "📁 Configuration du projet Railway..."

# Vérifier si un projet existe déjà
if railway status &> /dev/null; then
    echo "✅ Projet Railway existant détecté"
    PROJECT_ID=$(railway status --json | jq -r '.project.id' 2>/dev/null || echo "")
    echo "📋 Project ID: $PROJECT_ID"
else
    echo "🆕 Création d'un nouveau projet Railway..."
    railway init
    PROJECT_ID=$(railway status --json | jq -r '.project.id' 2>/dev/null || echo "")
    echo "📋 Nouveau Project ID: $PROJECT_ID"
fi

# Mettre à jour le fichier de configuration
if [ ! -z "$PROJECT_ID" ]; then
    sed -i "s/RAILWAY_PROJECT_ID=\"\"/RAILWAY_PROJECT_ID=\"$PROJECT_ID\"/" railway-config.env
    echo "✅ Project ID configuré dans railway-config.env"
fi

# Configurer les variables d'environnement
echo "🔧 Configuration des variables d'environnement..."

# Lire les variables depuis le fichier de configuration
if [ -f "railway-config.env" ]; then
    source railway-config.env
    
    for var in "${ENVIRONMENT_VARIABLES[@]}"; do
        key=$(echo $var | cut -d'=' -f1)
        value=$(echo $var | cut -d'=' -f2-)
        
        if [ "$key" = "SUPABASE_URL" ] && [ "$value" = "https://your-project.supabase.co" ]; then
            echo "⚠️ Veuillez configurer SUPABASE_URL dans railway-config.env"
        elif [ "$key" = "SUPABASE_ANON_KEY" ] && [ "$value" = "eyJ..." ]; then
            echo "⚠️ Veuillez configurer SUPABASE_ANON_KEY dans railway-config.env"
        else
            railway variables set $key="$value"
            echo "✅ Variable $key configurée"
        fi
    done
fi

# Configurer le domaine personnalisé
echo "🌐 Configuration du domaine personnalisé..."
if [ ! -z "$RAILWAY_DOMAIN" ]; then
    railway domain add $RAILWAY_DOMAIN
    echo "✅ Domaine $RAILWAY_DOMAIN configuré"
    echo "📋 Configurez votre DNS:"
    echo "   Type: CNAME"
    echo "   Name: mcp"
    echo "   Value: $(railway domain --json | jq -r '.domain' 2>/dev/null || echo 'your-app.railway.app')"
fi

# Configurer le monitoring
echo "📊 Configuration du monitoring..."
if [ "$RAILWAY_MONITORING_ENABLED" = "true" ]; then
    railway monitoring enable
    echo "✅ Monitoring activé"
fi

# Déployer le projet
echo "🚀 Déploiement initial..."
railway up

echo ""
echo "🎉 Configuration Railway terminée !"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Configurez vos variables d'environnement dans railway-config.env"
echo "2. Configurez votre DNS pour pointer vers Railway"
echo "3. Testez le déploiement avec: bash scripts/auto-deploy-complete.sh test"
echo "4. Activez la surveillance continue avec: bash scripts/auto-deploy-complete.sh monitor"
echo ""
echo "🔗 Liens utiles:"
echo "- Railway Dashboard: https://railway.app/dashboard"
echo "- Votre projet: https://railway.app/project/$PROJECT_ID"
echo "- Logs: railway logs"
echo "- Status: railway status"
