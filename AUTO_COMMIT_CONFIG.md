# Configuration Auto-Commit et Push

## 🚀 Système d'Automatisation Complet

Ce projet dispose maintenant d'un système complet d'auto-commit et push qui fonctionne de plusieurs façons :

### 📋 Méthodes d'Activation

#### 1. **Surveillance Continue (Recommandée)**
```bash
# Démarrer la surveillance automatique
npm run watch
# ou
bash scripts/start-auto-commit.sh
```

#### 2. **Commit et Push Manuel**
```bash
# Commit et push immédiat
npm run auto-push

# Commit + push + build Smithery
npm run full-auto
```

#### 3. **Hooks Git Automatiques**
- Le hook `post-commit` s'exécute automatiquement après chaque commit
- Push automatique vers `origin/main`
- Build Smithery automatique après push réussi

### ⚙️ Configuration

#### Dossiers Surveillés
- `src/` - Code source principal
- `scripts/` - Scripts d'automatisation
- `package.json` - Configuration npm
- `tsconfig.json` - Configuration TypeScript
- `smithery.yaml` - Configuration Smithery
- `README.md` - Documentation
- `requirements.txt` - Dépendances Python
- `pyproject.toml` - Configuration Python

#### Paramètres
- **Cooldown entre commits** : 30 secondes
- **Délai de détection** : 2 secondes après changement
- **Branche cible** : `main`
- **Messages de commit** : `🤖 Auto-commit: [timestamp]`

### 📁 Fichiers Créés

```
scripts/
├── auto-commit-watcher.js    # Surveillance des fichiers
├── start-auto-commit.sh      # Démarrage automatique
└── post-commit.sh           # Hook post-commit (existant)

.git/hooks/
└── post-commit              # Hook Git automatique

logs/
├── auto-commit.log          # Logs du système
└── watcher.log              # Logs de surveillance
```

### 🎯 Scripts NPM Disponibles

- `npm run watch` - Surveillance continue des fichiers
- `npm run auto-commit` - Alias pour la surveillance
- `npm run auto-push` - Commit et push immédiat
- `npm run smithery-build` - Build Smithery uniquement
- `npm run full-auto` - Commit + push + build Smithery

### 🔧 Fonctionnalités

✅ **Surveillance automatique** des changements de fichiers  
✅ **Commit automatique** avec messages horodatés  
✅ **Push automatique** vers origin/main  
✅ **Build Smithery** après chaque push réussi  
✅ **Cooldown intelligent** pour éviter les commits excessifs  
✅ **Logs détaillés** pour le debugging  
✅ **Gestion des erreurs** robuste  
✅ **Arrêt propre** avec Ctrl+C  

### 🚨 Notes Importantes

- Le système ne commit que sur la branche `main`
- Un cooldown de 30 secondes évite les commits excessifs
- Les fichiers dans `node_modules`, `.git`, `.smithery` sont ignorés
- Le système redémarre automatiquement en cas de crash
- Tous les logs sont sauvegardés dans le dossier `logs/`

### 🛑 Arrêt du Système

```bash
# Arrêt propre avec Ctrl+C
# ou
pkill -f "auto-commit-watcher"
```
