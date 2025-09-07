# Supabase MCP Server - Self-Hosted Edition

🗄️ **Serveur MCP Supabase Self-Hosted** - Gestion complète de votre instance Supabase privée

## 🌟 Fonctionnalités

- 🔐 **Gestion complète** de votre instance Supabase privée
- 🛠️ **54+ outils MCP** pour l'administration Supabase
- 📊 **Monitoring** et métriques en temps réel
- 🚀 **Déploiement automatique** sur Railway
- 🔒 **Sécurité renforcée** avec prévention SQL injection
- ⚡ **Performance optimisée** pour la production

## 🏗️ Architecture

Ce repository contient **uniquement** le serveur MCP Supabase pur, sans interface web ni hub central.

```
Supabase MCP Server (Port 8000)
├── 🗄️ Gestion de base de données
├── 🔐 Authentification et autorisation
├── 📁 Stockage et fichiers
├── 🔄 Temps réel et subscriptions
├── 🛠️ Migrations et schémas
├── 📊 Monitoring et logs
└── 🚀 Déploiement automatique
```

## 🚀 Démarrage Rapide

### Prérequis
- Python 3.11+
- Instance Supabase (self-hosted ou cloud)
- Variables d'environnement Supabase

### Installation

```bash
# Cloner le repository
git clone https://github.com/MisterSandFR/Supabase-MCP-SelfHosted.git
cd Supabase-MCP-SelfHosted

# Installer les dépendances Python
pip install -r requirements.txt

# Configurer les variables d'environnement
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
export SUPABASE_SERVICE_KEY="your-service-key"  # Optionnel

# Démarrer le serveur
python src/supabase_server.py
```

### Avec Docker

```bash
# Build et démarrage
docker build -t supabase-mcp-server .
docker run -p 8000:8000 \
  -e SUPABASE_URL="https://your-project.supabase.co" \
  -e SUPABASE_ANON_KEY="your-anon-key" \
  supabase-mcp-server
```

## ⚙️ Configuration

### Variables d'Environnement

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ... (votre clé anonyme)
SUPABASE_SERVICE_KEY=eyJ... (optionnel, pour opérations privilégiées)

# Server Configuration
PORT=8000
PYTHONUNBUFFERED=1
```

## 🛠️ Outils MCP Disponibles

### Base de Données (15 outils)
- `execute_sql` - Exécution de requêtes SQL
- `list_tables` - Liste des tables
- `inspect_schema` - Inspection du schéma
- `apply_migration` - Application de migrations
- `backup_database` - Sauvegarde de base
- `restore_database` - Restauration de base
- `vacuum_analyze` - Optimisation de base
- `get_database_stats` - Statistiques de base
- `create_index` - Création d'index
- `drop_index` - Suppression d'index
- `list_extensions` - Liste des extensions
- `manage_extensions` - Gestion des extensions
- `execute_psql` - Commandes psql
- `check_health` - Vérification de santé
- `get_database_connections` - Connexions de base

### Authentification (8 outils)
- `list_auth_users` - Liste des utilisateurs
- `create_auth_user` - Création d'utilisateur
- `update_auth_user` - Mise à jour d'utilisateur
- `delete_auth_user` - Suppression d'utilisateur
- `get_auth_user` - Récupération d'utilisateur
- `verify_jwt_secret` - Vérification JWT
- `manage_roles` - Gestion des rôles
- `manage_rls_policies` - Gestion des politiques RLS

### Stockage (6 outils)
- `list_storage_buckets` - Liste des buckets
- `list_storage_objects` - Liste des objets
- `manage_storage_policies` - Gestion des politiques
- `upload_file` - Upload de fichier
- `download_file` - Téléchargement de fichier
- `delete_file` - Suppression de fichier

### Temps Réel (4 outils)
- `list_realtime_publications` - Liste des publications
- `manage_realtime` - Gestion du temps réel
- `create_subscription` - Création de subscription
- `delete_subscription` - Suppression de subscription

### Migrations (8 outils)
- `create_migration` - Création de migration
- `list_migrations` - Liste des migrations
- `push_migrations` - Push des migrations
- `validate_migration` - Validation de migration
- `smart_migration` - Migration intelligente
- `auto_migrate` - Migration automatique
- `sync_schema` - Synchronisation de schéma
- `import_schema` - Import de schéma

### Monitoring (5 outils)
- `get_logs` - Récupération des logs
- `metrics_dashboard` - Tableau de bord métriques
- `analyze_performance` - Analyse de performance
- `analyze_rls_coverage` - Analyse couverture RLS
- `audit_security` - Audit de sécurité

### Utilitaires (8 outils)
- `generate_typescript_types` - Génération de types TS
- `generate_crud_api` - Génération d'API CRUD
- `cache_management` - Gestion du cache
- `environment_management` - Gestion d'environnement
- `manage_secrets` - Gestion des secrets
- `manage_functions` - Gestion des fonctions
- `manage_triggers` - Gestion des triggers
- `manage_webhooks` - Gestion des webhooks

## 🔧 API Endpoints

### Serveur MCP
- `GET /health` - Health check
- `POST /mcp` - Endpoint JSON-RPC principal
- `GET /.well-known/mcp-config` - Configuration MCP

### Outils Spécialisés
- `GET /api/tools` - Liste des outils disponibles
- `POST /api/execute` - Exécution d'outils

## 🚀 Déploiement

### Railway (Recommandé)
```bash
# Déployer sur Railway
railway login
railway init
railway up
```

### Docker
```bash
# Build et déploiement
docker build -t supabase-mcp-server .
docker run -p 8000:8000 supabase-mcp-server
```

### Intégration avec Hub Central

Ce serveur est conçu pour être intégré avec le [MCP Hub Central](https://github.com/coupaul/mcp-hub-central) :

```json
{
  "servers": {
    "supabase": {
      "name": "Supabase MCP Server",
      "host": "supabase.mcp.coupaul.fr",
      "port": 8000,
      "path": "/supabase",
      "categories": ["database", "auth", "storage", "realtime", "security", "migration", "monitoring", "performance"]
    }
  }
}
```

## 🔒 Sécurité

- **Validation des entrées** pour prévenir les injections SQL
- **Rate limiting** par IP et utilisateur
- **Audit logs** de toutes les opérations
- **Chiffrement HTTPS** obligatoire en production
- **Gestion des secrets** sécurisée
- **Politiques RLS** pour la sécurité des données

## 📊 Monitoring

Le serveur fournit un monitoring complet :

- **Métriques de performance** en temps réel
- **Logs structurés** avec niveaux configurables
- **Health checks** automatiques
- **Alertes** en cas de problème
- **Tableau de bord** métriques
- **Analyse de performance** détaillée

## 🤝 Contribution

1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Supabase](https://supabase.com/) pour la plateforme
- [Smithery](https://smithery.ai) pour l'écosystème MCP
- La communauté Supabase pour les contributions

## 📞 Support

- 📧 Email : contact@coupaul.fr
- 💬 Discord : [Serveur MCP Community](https://discord.gg/mcp)
- 🐛 Issues : [GitHub Issues](https://github.com/MisterSandFR/Supabase-MCP-SelfHosted/issues)

---

**Fait avec ❤️ par [coupaul](https://github.com/coupaul)**