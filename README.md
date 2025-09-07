# Minecraft MCP Forge 1.6.4

🎮 **Serveur MCP Minecraft GUI** - Analyse automatique des spritesheets et génération de code Java 7

## 🌟 Fonctionnalités

- 🎨 **Analyse automatique** des spritesheets GUI Minecraft
- ☕ **Génération de code Java 7** compatible Forge 1.6.4
- 🔧 **Outils MCP spécialisés** pour le développement Minecraft
- 📊 **Monitoring** et métriques en temps réel
- 🚀 **Déploiement automatique** sur Railway
- 📈 **Performance** optimisée pour le développement mod

## 🏗️ Architecture

Ce repository contient **uniquement** le serveur MCP Minecraft pur, sans interface web ni hub central.

```
Minecraft MCP Server (Port 8002)
├── 🎨 Analyse des spritesheets
├── ☕ Génération de code Java
├── 🔧 Outils de développement
├── 📊 Monitoring
└── 🚀 Déploiement automatique
```

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+
- Java 7 (pour compiler le code généré)
- Forge 1.6.4 (MCPC+)

### Installation

```bash
# Cloner le repository
git clone https://github.com/coupaul/Minecraft-MCP-Forge-1.6.4.git
cd Minecraft-MCP-Forge-1.6.4

# Installer les dépendances
cd server
npm install

# Build le projet
npm run build

# Démarrer le serveur
npm start
```

### Avec Docker

```bash
# Build et démarrage
docker build -t minecraft-mcp-server .
docker run -p 8002:8002 minecraft-mcp-server
```

## ⚙️ Configuration

### Variables d'Environnement

```bash
# Server Configuration
PORT=8002
LOG_LEVEL=INFO
NODE_ENV=production

# Minecraft Configuration
MINECRAFT_VERSION=1.6.4
FORGE_VERSION=1.6.4-9.11.1.965
```

## 🛠️ Outils MCP Disponibles

### Analyse GUI (5 outils)
- `analyze_spritesheet` - Analyse des spritesheets GUI
- `extract_gui_elements` - Extraction des éléments GUI
- `generate_gui_code` - Génération de code GUI Java
- `validate_gui_structure` - Validation de la structure GUI
- `optimize_gui_layout` - Optimisation du layout GUI

### Génération de Code (3 outils)
- `generate_java_class` - Génération de classe Java
- `generate_forge_mod` - Génération de mod Forge
- `compile_java_code` - Compilation du code Java

### Développement (2 outils)
- `create_mod_structure` - Création de structure de mod
- `validate_mod_code` - Validation du code de mod

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
docker build -t minecraft-mcp-server .
docker run -p 8002:8002 minecraft-mcp-server
```

### Intégration avec Hub Central

Ce serveur est conçu pour être intégré avec le [MCP Hub Central](https://github.com/coupaul/mcp-hub-central) :

```json
{
  "servers": {
    "minecraft": {
      "name": "Minecraft MCP Server",
      "host": "minecraft.mcp.coupaul.fr",
      "port": 8002,
      "path": "/minecraft",
      "categories": ["gui", "code_generation", "development", "forge"]
    }
  }
}
```

## 🔒 Sécurité

- **Validation des entrées** pour prévenir les injections
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

- [Minecraft Forge](https://files.minecraftforge.net/) pour la plateforme
- [Smithery](https://smithery.ai) pour l'écosystème MCP
- La communauté Minecraft modding pour les contributions

## 📞 Support

- 📧 Email : support@mcp.coupaul.fr
- 💬 Discord : [Serveur MCP Community](https://discord.gg/mcp)
- 🐛 Issues : [GitHub Issues](https://github.com/coupaul/Minecraft-MCP-Forge-1.6.4/issues)

---

**Fait avec ❤️ par [coupaul](https://github.com/coupaul)**