#!/bin/bash

# Script de surveillance en arrière-plan pour l'automatisation
# Ce script surveille les changements et déclenche l'automatisation

# Configuration
WATCH_DIRS=("src/" "scripts/" "pyproject.toml" "Dockerfile" "railway.toml")
LOG_FILE="logs/auto-deploy.log"
PID_FILE="logs/auto-deploy.pid"
CHECK_INTERVAL=30  # secondes

# Créer le dossier logs
mkdir -p logs

# Fonction de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Fonction pour vérifier les changements
check_changes() {
    local has_changes=false
    
    for dir in "${WATCH_DIRS[@]}"; do
        if [ -e "$dir" ]; then
            if git diff --quiet "$dir" 2>/dev/null; then
                continue
            else
                has_changes=true
                log "📝 Changements détectés dans: $dir"
            fi
        fi
    done
    
    # Vérifier aussi les fichiers non suivis
    if [ $(git status --porcelain | wc -l) -gt 0 ]; then
        has_changes=true
        log "📝 Fichiers non suivis détectés"
    fi
    
    echo $has_changes
}

# Fonction pour démarrer l'automatisation
start_automation() {
    log "🚀 Démarrage de l'automatisation..."
    
    # Vérifier s'il y a vraiment des changements significatifs
    if git diff --quiet && git diff --cached --quiet; then
        log "⚠️ Aucun changement significatif détecté, pas d'automatisation"
        return 0
    fi
    
    # Vérifier si les changements sont dans des fichiers importants
    important_files=("src/" "requirements.txt" "Dockerfile" "pyproject.toml")
    has_important_changes=false
    
    for file in "${important_files[@]}"; do
        if git diff --quiet "$file" 2>/dev/null; then
            continue
        else
            has_important_changes=true
            log "📝 Changement important détecté dans: $file"
        fi
    done
    
    if [ "$has_important_changes" = "false" ]; then
        log "⚠️ Aucun changement important détecté, pas d'automatisation"
        return 0
    fi
    
    if bash scripts/auto-deploy-complete.sh automate; then
        log "✅ Automatisation réussie"
    else
        log "❌ Échec de l'automatisation"
    fi
}

# Fonction pour arrêter proprement
cleanup() {
    log "🛑 Arrêt de la surveillance..."
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
    fi
    exit 0
}

# Capturer les signaux d'arrêt
trap cleanup SIGINT SIGTERM

# Fonction principale de surveillance
monitor() {
    log "👀 Surveillance des changements activée..."
    log "📁 Dossiers surveillés: ${WATCH_DIRS[*]}"
    log "⏱️ Intervalle de vérification: ${CHECK_INTERVAL}s"
    
    # Sauvegarder le PID
    echo $$ > "$PID_FILE"
    
    local last_check_time=$(date +%s)
    
    while true; do
        current_time=$(date +%s)
        
        # Vérifier les changements
        if check_changes; then
            log "🔄 Changements détectés, démarrage de l'automatisation..."
            start_automation
            last_check_time=$current_time
        fi
        
        # Attendre l'intervalle
        sleep $CHECK_INTERVAL
    done
}

# Fonction pour afficher le statut
show_status() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            echo "✅ Surveillance active (PID: $pid)"
            echo "📊 Logs: tail -f $LOG_FILE"
        else
            echo "❌ Surveillance arrêtée"
            rm -f "$PID_FILE"
        fi
    else
        echo "❌ Surveillance non démarrée"
    fi
}

# Fonction pour arrêter la surveillance
stop_monitoring() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid
            rm -f "$PID_FILE"
            echo "✅ Surveillance arrêtée"
        else
            echo "❌ Surveillance déjà arrêtée"
            rm -f "$PID_FILE"
        fi
    else
        echo "❌ Aucune surveillance active"
    fi
}

# Menu principal
case "${1:-start}" in
    "start")
        monitor
        ;;
    "stop")
        stop_monitoring
        ;;
    "status")
        show_status
        ;;
    "restart")
        stop_monitoring
        sleep 2
        monitor
        ;;
    "logs")
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "❌ Fichier de logs non trouvé"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|logs}"
        echo ""
        echo "  start   - Démarrer la surveillance (défaut)"
        echo "  stop    - Arrêter la surveillance"
        echo "  status  - Afficher le statut"
        echo "  restart - Redémarrer la surveillance"
        echo "  logs    - Afficher les logs en temps réel"
        exit 1
        ;;
esac
