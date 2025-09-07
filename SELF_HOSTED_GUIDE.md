# Guide de Déploiement Self-Hosted + Smithery Listing

## 🎯 Configuration Hybride
- **Self-hosted** : mcp.coupaul.fr
- **Listing** : Smithery (pour la découverte)
- **Avantage** : Contrôle total + visibilité

## 🚀 Déploiement sur Railway (Recommandé)

### 1. Configuration Railway
1. Allez sur https://railway.app/
2. Connectez votre compte GitHub
3. Créez un nouveau projet
4. Sélectionnez ce repository
5. Railway détectera automatiquement le Dockerfile

### 2. Configuration du domaine
1. Dans Railway, allez dans Settings → Domains
2. Ajoutez le domaine personnalisé : `mcp.coupaul.fr`
3. Configurez le DNS :
   - CNAME: `mcp.coupaul.fr` → `your-app.railway.app`

### 3. Variables d'environnement
Configurez dans Railway → Variables :
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ... (votre clé anonyme)
SUPABASE_SERVICE_KEY=eyJ... (optionnel)
```

## 🌐 Déploiement sur Render

### 1. Configuration Render
1. Allez sur https://render.com/
2. Connectez votre compte GitHub
3. Créez un nouveau Web Service
4. Sélectionnez ce repository
5. Utilisez le fichier `render.yaml`

### 2. Configuration du domaine
1. Dans Render, allez dans Settings → Custom Domains
2. Ajoutez le domaine : `mcp.coupaul.fr`
3. Configurez le DNS

## 🔧 Configuration DNS

### Pour Railway :
```
Type: CNAME
Name: mcp
Value: your-app.railway.app
```

### Pour Render :
```
Type: CNAME
Name: mcp
Value: your-app.onrender.com
```

## 📝 Configuration Smithery Listing

Votre serveur est déjà configuré pour être listé sur Smithery :
- ✅ Décorateur `@smithery.server` avec métadonnées
- ✅ Description et tags
- ✅ Homepage : https://mcp.coupaul.fr
- ✅ Repository GitHub

## 🧪 Test de Connectivité

### 1. Test local
```bash
python src/supabase_server.py
```

### 2. Test MCP
Utilisez un client MCP pour tester :
- `test_connection` : Teste la connexion
- `check_health` : Vérifie la santé
- `list_tables` : Liste les tables

### 3. Test depuis Smithery
1. Allez sur https://smithery.ai/
2. Trouvez votre serveur
3. Configurez les clés Supabase
4. Testez les outils

## 🎯 Avantages de cette Configuration

✅ **Contrôle total** sur votre infrastructure
✅ **Domaine personnalisé** mcp.coupaul.fr
✅ **Visibilité** sur Smithery
✅ **Flexibilité** de configuration
✅ **Pas de dépendance** à Smithery pour l'hébergement
✅ **Auto-commit** et déploiement automatique

## 🚀 Prochaines Étapes

1. **Déployez** sur Railway ou Render
2. **Configurez** le domaine mcp.coupaul.fr
3. **Testez** la connectivité MCP
4. **Vérifiez** le listing sur Smithery
5. **Partagez** votre serveur MCP !
