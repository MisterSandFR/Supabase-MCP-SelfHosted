# Supabase MCP Server

🗄️ **Serveur MCP Supabase Pur** - 47 outils MCP pour la gestion autonome de Supabase

## 🌟 Fonctionnalités

- 🗄️ **47 outils MCP** spécialisés pour Supabase
- 🔐 **Gestion complète** de l'authentification
- 📊 **Monitoring** et métriques en temps réel
- 🔒 **Sécurité avancée** avec RLS et audit
- 🚀 **Migrations** automatiques et intelligentes
- 📈 **Performance** optimisée avec indexation automatique

## 🏗️ Architecture

Ce repository contient **uniquement** le serveur MCP Supabase pur, sans interface web ni hub central.

```
Supabase MCP Server (Port 8001)
├── 🗄️ 47 outils Supabase
├── 🔐 Gestion Auth
├── 📊 Monitoring
├── 🔒 Sécurité RLS
└── 🚀 Migrations
```

## 🚀 Démarrage Rapide

### Prérequis
- Python 3.8+
- Accès à une instance Supabase

### Installation

```bash
# Cloner le repository
git clone https://github.com/MisterSandFR/Supabase-MCP-SelfHosted.git
cd Supabase-MCP-SelfHosted

# Installer les dépendances
pip install -r requirements.txt

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos credentials Supabase

# Démarrer le serveur
python src/supabase_server.py
```

### Avec Docker

```bash
# Build et démarrage
docker build -t supabase-mcp-server .
docker run -p 8001:8001 supabase-mcp-server
```

## ⚙️ Configuration

### Variables d'Environnement

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server Configuration
PORT=8001
LOG_LEVEL=INFO
```

## 🛠️ Outils MCP Disponibles

### Base de Données (8 outils)
- `execute_sql` - Exécution SQL avancée
- `check_health` - Santé de la base de données
- `list_tables` - Liste des tables
- `inspect_schema` - Inspection du schéma
- `get_database_stats` - Statistiques de la DB

### Authentification (5 outils)
- `create_auth_user` - Création d'utilisateur
- `get_auth_user` - Récupération d'utilisateur
- `list_auth_users` - Liste des utilisateurs
- `update_auth_user` - Mise à jour d'utilisateur
- `delete_auth_user` - Suppression d'utilisateur

### Stockage (3 outils)
- `list_storage_buckets` - Liste des buckets
- `list_storage_objects` - Liste des objets
- `manage_storage_policies` - Gestion des politiques

### Sécurité (2 outils)
- `manage_rls_policies` - Gestion RLS
- `analyze_rls_coverage` - Analyse de couverture RLS

### Migrations (6 outils)
- `create_migration` - Création de migration
- `apply_migration` - Application de migration
- `list_migrations` - Liste des migrations
- `push_migrations` - Push des migrations
- `validate_migration` - Validation de migration
- `smart_migration` - Migration intelligente

### Performance (3 outils)
- `analyze_performance` - Analyse de performance
- `auto_create_indexes` - Création automatique d'index
- `vacuum_analyze` - VACUUM ANALYZE

### Monitoring (2 outils)
- `get_logs` - Récupération des logs
- `metrics_dashboard` - Tableau de bord des métriques

### Et plus...

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
docker run -p 8001:8001 supabase-mcp-server
```

### Intégration avec Hub Central

Ce serveur est conçu pour être intégré avec le [MCP Hub Central](https://github.com/coupaul/mcp-hub-central) :

```json
{
  "servers": {
    "supabase": {
      "name": "Supabase MCP Server",
      "host": "supabase-mcp-server",
      "port": 8001,
      "path": "/supabase",
      "categories": ["database", "auth", "storage", "realtime", "security"]
    }
  }
}
```

## 🔒 Sécurité

- **Authentification JWT** pour l'accès aux outils
- **Validation des entrées** SQL pour prévenir les injections
- **Rate limiting** par IP et utilisateur
- **Audit logs** de toutes les opérations
- **Chiffrement HTTPS** obligatoire en production

## 📊 Monitoring

Le serveur fournit un monitoring complet :

- **Métriques de performance** en temps réel
- **Logs structurés** avec niveaux configurables
- **Health checks** automatiques
- **Alertes** en cas de problème

## 🤝 Contribution

1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Supabase](https://supabase.com) pour la plateforme
- [Smithery](https://smithery.ai) pour l'écosystème MCP
- La communauté Supabase pour les contributions

## 📞 Support

- 📧 Email : support@mcp.coupaul.fr
- 💬 Discord : [Serveur MCP Community](https://discord.gg/mcp)
- 🐛 Issues : [GitHub Issues](https://github.com/MisterSandFR/Supabase-MCP-SelfHosted/issues)

---

**Fait avec ❤️ par [MisterSandFR](https://github.com/MisterSandFR)**