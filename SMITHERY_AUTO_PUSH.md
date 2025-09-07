# Configuration Smithery - Push Automatique
# ======================================

## Consigne Automatique
**Push automatique via Smithery CLI après chaque commit & push**

Cette configuration automatise le processus de déploiement avec Smithery CLI :

### 🚀 Processus Automatisé
1. **Commit Git** → Déclenche automatiquement le hook post-commit
2. **Construction** → `smithery build` compile le projet
3. **Push/Déploiement** → Tentative de push automatique vers Smithery

### 📁 Fichiers Configurés
- `scripts/post-commit.sh` - Script principal d'automatisation
- `.git/hooks/post-commit` - Hook git qui s'exécute après chaque commit
- `smithery.yaml` - Configuration Smithery (runtime: python)

### 🔧 Prérequis
- Smithery CLI installé : `npm install -g @smithery/cli`
- Connexion Smithery : `smithery login`
- Projet configuré avec `smithery.yaml`

### ⚡ Utilisation
Le processus est maintenant **100% automatique** :
```bash
git add .
git commit -m "Votre message"
# → Le push Smithery s'exécute automatiquement !
```

### 🛠️ Commandes Manuelles (si nécessaire)
```bash
# Construction manuelle
smithery build

# Déploiement manuel (si disponible)
smithery push
# ou
smithery deploy

# Vérification du statut
smithery list
```

### 📝 Notes
- Le hook git s'exécute automatiquement après chaque commit
- En cas d'erreur, le processus s'arrête avec un message d'erreur clair
- Compatible avec Windows (Git Bash) et Unix/Linux
- Logs détaillés pour le debugging

---
*Configuration créée le $(date)*
*Dernière mise à jour : Automatique via git hooks*
