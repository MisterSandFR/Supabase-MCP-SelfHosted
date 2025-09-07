#!/bin/bash
# Script de vérification et configuration DNS pour mcp.coupaul.fr

echo "🌐 Vérification et configuration DNS"
echo "===================================="
echo "Domaine: mcp.coupaul.fr"
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

# Test 1: Vérifier la résolution DNS
log "Test 1: Vérification de la résolution DNS"
DNS_RESULT=$(nslookup mcp.coupaul.fr 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}')
if [ ! -z "$DNS_RESULT" ]; then
    log_success "Résolution DNS OK: mcp.coupaul.fr -> $DNS_RESULT"
else
    log_error "Impossible de résoudre mcp.coupaul.fr"
    echo "Vérifiez votre configuration DNS"
fi

# Test 2: Vérifier les enregistrements A
log "Test 2: Vérification des enregistrements A"
dig +short mcp.coupaul.fr A 2>/dev/null
if [ $? -eq 0 ]; then
    log_success "Enregistrement A trouvé"
else
    log_warning "Aucun enregistrement A trouvé"
fi

# Test 3: Vérifier les enregistrements CNAME
log "Test 3: Vérification des enregistrements CNAME"
dig +short mcp.coupaul.fr CNAME 2>/dev/null
if [ $? -eq 0 ]; then
    log_success "Enregistrement CNAME trouvé"
else
    log "Aucun enregistrement CNAME (normal pour un domaine principal)"
fi

# Test 4: Vérifier la propagation DNS
log "Test 4: Vérification de la propagation DNS"
echo "Test avec différents serveurs DNS..."

# Test avec Google DNS
GOOGLE_DNS=$(nslookup mcp.coupaul.fr 8.8.8.8 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}')
if [ ! -z "$GOOGLE_DNS" ]; then
    log_success "Propagation DNS Google OK: $GOOGLE_DNS"
else
    log_warning "Propagation DNS Google échouée"
fi

# Test avec Cloudflare DNS
CLOUDFLARE_DNS=$(nslookup mcp.coupaul.fr 1.1.1.1 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}')
if [ ! -z "$CLOUDFLARE_DNS" ]; then
    log_success "Propagation DNS Cloudflare OK: $CLOUDFLARE_DNS"
else
    log_warning "Propagation DNS Cloudflare échouée"
fi

# Test 5: Vérifier la connectivité TCP
log "Test 5: Vérification de la connectivité TCP"
if [ ! -z "$DNS_RESULT" ]; then
    # Test port 80
    if timeout 5 bash -c "</dev/tcp/$DNS_RESULT/80" 2>/dev/null; then
        log_success "Port 80 accessible sur $DNS_RESULT"
    else
        log_warning "Port 80 non accessible sur $DNS_RESULT"
    fi
    
    # Test port 443
    if timeout 5 bash -c "</dev/tcp/$DNS_RESULT/443" 2>/dev/null; then
        log_success "Port 443 accessible sur $DNS_RESULT"
    else
        log_warning "Port 443 non accessible sur $DNS_RESULT"
    fi
fi

echo ""
echo "🔧 Configuration DNS recommandée:"
echo "==============================="

# Recommandations basées sur les tests
if [ -z "$DNS_RESULT" ]; then
    echo "1. 🌐 Configurer l'enregistrement DNS"
    echo "   - Ajouter un enregistrement A: mcp.coupaul.fr -> VOTRE_IP_SERVEUR"
    echo "   - Ou un enregistrement CNAME: mcp.coupaul.fr -> votre-serveur.railway.app"
fi

if [ -z "$GOOGLE_DNS" ] || [ -z "$CLOUDFLARE_DNS" ]; then
    echo "2. ⏰ Attendre la propagation DNS"
    echo "   - La propagation peut prendre jusqu'à 48h"
    echo "   - Utilisez des outils en ligne pour vérifier"
fi

echo ""
echo "3. 🔗 Configuration Railway (si applicable)"
echo "   - Ajouter un domaine personnalisé dans Railway"
echo "   - Configurer les enregistrements DNS selon Railway"
echo "   - Attendre la validation du domaine"

echo ""
echo "4. 🌍 Outils de vérification DNS:"
echo "   - DNS Checker: https://dnschecker.org/"
echo "   - What's My DNS: https://whatsmydns.net/"
echo "   - DNS Propagation: https://dnspropagation.net/"

echo ""
echo "5. 📋 Enregistrements DNS nécessaires:"
echo "   Type: A"
echo "   Nom: mcp"
echo "   Valeur: VOTRE_IP_SERVEUR"
echo "   TTL: 300 (5 minutes)"

echo ""
log_success "Vérification DNS terminée !"
