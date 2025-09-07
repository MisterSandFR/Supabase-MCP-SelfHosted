# Configuration pour déploiement sur mcp.coupaul.fr

## Option A: Railway (Recommandé)
1. Connectez votre GitHub à Railway
2. Déployez directement depuis ce repository
3. Configurez le domaine personnalisé mcp.coupaul.fr
4. Railway gère automatiquement SSL et déploiements

## Option B: Docker sur votre serveur
1. Clonez le repository sur votre serveur
2. Configurez Docker Compose
3. Configurez nginx comme reverse proxy
4. Pointez mcp.coupaul.fr vers votre serveur

## Option C: Render.com
1. Connectez votre GitHub à Render
2. Créez un nouveau Web Service
3. Configurez le domaine personnalisé
4. Render gère automatiquement les déploiements

## Configuration DNS nécessaire:
- CNAME: mcp.coupaul.fr → votre-serveur.railway.app
- Ou A record vers l'IP de votre serveur

## Variables d'environnement à configurer:
- SUPABASE_URL=votre-url-supabase
- SUPABASE_ANON_KEY=votre-cle-anonyme
- SUPABASE_SERVICE_KEY=votre-cle-service (optionnel)
