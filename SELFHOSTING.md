# Supabase MCP Server - Self-Hosted Edition 🏠

## 🚀 Déploiement Self-Hosted

Ce serveur MCP Supabase peut être hébergé sur votre propre infrastructure et utilisé avec Smithery en mode self-hosted.

### 📋 Prérequis

- Docker installé
- Variables d'environnement Supabase
- Port 3000 disponible

### ⚙️ Configuration

1. **Variables d'environnement** :
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"  # Optionnel
export DATABASE_URL="postgresql://..."  # Optionnel
```

2. **Déploiement automatique** :
```bash
./scripts/deploy-selfhosted.sh
```

3. **Déploiement manuel** :
```bash
# Construction
docker build -t supabase-mcp-server .

# Démarrage
docker run -d \
  --name supabase-mcp \
  -p 3000:3000 \
  -e SUPABASE_URL="$SUPABASE_URL" \
  -e SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  supabase-mcp-server
```

### 🔧 Configuration Smithery Self-Hosted

1. **Dans Smithery** :
   - Sélectionnez "Self-Hosted Server"
   - URL : `http://your-domain:3000`
   - Variables d'environnement : Ajoutez vos clés Supabase

2. **Test de connexion** :
```bash
curl http://localhost:3000/health
```

### 🛠️ Outils Disponibles

- ✅ `execute_sql` - Exécution de requêtes SQL
- ✅ `list_tables` - Liste des tables
- ✅ `check_health` - Vérification de santé
- ✅ `list_auth_users` - Gestion des utilisateurs
- ✅ `create_auth_user` - Création d'utilisateurs
- ✅ `manage_extensions` - Gestion des extensions
- ✅ `generate_typescript_types` - Génération de types
- ✅ `backup_database` - Sauvegarde de base
- ✅ `import_schema` - Import de schémas
- ✅ `execute_psql` - Commandes psql
- ✅ `inspect_schema` - Inspection de schéma
- ✅ `apply_migration` - Application de migrations

### 🔍 Monitoring

```bash
# Logs en temps réel
docker logs -f supabase-mcp

# Statut du conteneur
docker ps | grep supabase-mcp

# Test de santé
curl http://localhost:3000/health
```

### 🚀 Avantages du Self-Hosting

- ✅ **Contrôle total** : Votre infrastructure
- ✅ **Pas de dépendance** : Aucune plateforme externe
- ✅ **Performance** : Pas de latence réseau
- ✅ **Sécurité** : Vos données restent chez vous
- ✅ **Coût** : Seulement vos coûts d'infrastructure

### 🔧 Dépannage

**Problème** : Serveur ne démarre pas
```bash
# Vérifier les logs
docker logs supabase-mcp

# Vérifier les variables d'environnement
docker exec supabase-mcp env | grep SUPABASE
```

**Problème** : Connexion Smithery échoue
```bash
# Tester la connectivité
curl -v http://localhost:3000/health

# Vérifier le port
netstat -tlnp | grep 3000
```

### 📞 Support

Pour toute question sur le self-hosting :
- 📧 Email : support@your-domain.com
- 💬 Discord : Votre serveur Discord
- 📖 Documentation : Votre wiki
