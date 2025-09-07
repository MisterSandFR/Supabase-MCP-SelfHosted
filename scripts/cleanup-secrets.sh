#!/bin/bash
# Script de nettoyage des clés secrètes GitGuardian

echo "🔒 Nettoyage des clés secrètes GitGuardian"
echo "=========================================="
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

# Clé secrète détectée par GitGuardian (remplacée par placeholder)
SECRET_KEY="[CLÉ_SUPPRIMÉE_POUR_SÉCURITÉ]"

log "Clé secrète détectée: $SECRET_KEY"

# Étape 1: Supprimer le fichier contenant la clé
log "Étape 1: Suppression du fichier smithery-config.env"
if [ -f "smithery-config.env" ]; then
    rm "smithery-config.env"
    log_success "Fichier smithery-config.env supprimé"
else
    log_warning "Fichier smithery-config.env déjà supprimé"
fi

# Étape 2: Vérifier s'il y a d'autres occurrences
log "Étape 2: Recherche d'autres occurrences de la clé"
if grep -r "$SECRET_KEY" . --exclude-dir=.git 2>/dev/null; then
    log_warning "Autres occurrences trouvées"
    echo "Fichiers contenant la clé:"
    grep -r "$SECRET_KEY" . --exclude-dir=.git -l 2>/dev/null
else
    log_success "Aucune autre occurrence trouvée"
fi

# Étape 3: Ajouter à .gitignore
log "Étape 3: Ajout à .gitignore"
if ! grep -q "smithery-config.env" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Fichiers de configuration sensibles" >> .gitignore
    echo "smithery-config.env" >> .gitignore
    echo "*.env" >> .gitignore
    echo ".env" >> .gitignore
    log_success "Ajouté à .gitignore"
else
    log_success "Déjà dans .gitignore"
fi

# Étape 4: Créer un fichier d'exemple
log "Étape 4: Création d'un fichier d'exemple"
cat > smithery-config.env.example << 'EOF'
# Configuration Smithery CLI
# Copiez ce fichier vers smithery-config.env et ajoutez votre vraie clé

SMITHERY_API_KEY="votre-clé-api-smithery-ici"

# Utilisation automatique de la clé
export SMITHERY_API_KEY="votre-clé-api-smithery-ici"
EOF

log_success "Fichier d'exemple créé: smithery-config.env.example"

# Étape 5: Instructions pour l'utilisateur
echo ""
echo "🔧 Actions requises:"
echo "==================="
echo ""
echo "1. 🔄 Régénérer la clé API Smithery:"
echo "   - Allez sur https://smithery.ai"
echo "   - Régénérez votre clé API"
echo "   - Créez un nouveau fichier smithery-config.env avec la nouvelle clé"
echo ""
echo "2. 📝 Créer le fichier de configuration local:"
echo "   cp smithery-config.env.example smithery-config.env"
echo "   # Puis éditez smithery-config.env avec votre vraie clé"
echo ""
echo "3. 🚫 Ne jamais committer les fichiers .env:"
echo "   - smithery-config.env est maintenant dans .gitignore"
echo "   - Utilisez smithery-config.env.example comme modèle"
echo ""
echo "4. 🔒 Sécurité:"
echo "   - Gardez vos clés API privées"
echo "   - Utilisez des variables d'environnement"
echo "   - Ne committez jamais de vraies clés"

log_success "Nettoyage des clés secrètes terminé !"
