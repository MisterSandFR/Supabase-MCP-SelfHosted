#!/bin/bash
# Script de diagnostic et correction du certificat HTTPS pour mcp.coupaul.fr

echo "🔒 Diagnostic et correction du certificat HTTPS"
echo "=============================================="
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

# Test 1: Vérifier la connectivité HTTPS
log "Test 1: Vérification de la connectivité HTTPS"
if curl -I -s --connect-timeout 10 "https://mcp.coupaul.fr" > /dev/null 2>&1; then
    log_success "Connectivité HTTPS OK"
else
    log_error "Impossible de se connecter en HTTPS"
    log "Tentative de connexion HTTP..."
    if curl -I -s --connect-timeout 10 "http://mcp.coupaul.fr" > /dev/null 2>&1; then
        log_warning "HTTP fonctionne mais HTTPS échoue"
    else
        log_error "Aucune connectivité HTTP/HTTPS"
    fi
fi

# Test 2: Vérifier le certificat SSL
log "Test 2: Vérification du certificat SSL"
echo | openssl s_client -servername mcp.coupaul.fr -connect mcp.coupaul.fr:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null
if [ $? -eq 0 ]; then
    log_success "Certificat SSL accessible"
    
    # Vérifier la date d'expiration
    EXPIRY_DATE=$(echo | openssl s_client -servername mcp.coupaul.fr -connect mcp.coupaul.fr:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ ! -z "$EXPIRY_DATE" ]; then
        log "Date d'expiration du certificat: $EXPIRY_DATE"
        
        # Vérifier si le certificat expire bientôt (dans les 30 jours)
        EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$EXPIRY_DATE" +%s 2>/dev/null)
        CURRENT_TIMESTAMP=$(date +%s)
        DAYS_UNTIL_EXPIRY=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
        
        if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
            log_warning "Certificat expire dans $DAYS_UNTIL_EXPIRY jours"
        else
            log_success "Certificat valide pour $DAYS_UNTIL_EXPIRY jours"
        fi
    fi
else
    log_error "Impossible d'accéder au certificat SSL"
fi

# Test 3: Vérifier la chaîne de certificats
log "Test 3: Vérification de la chaîne de certificats"
CERT_CHAIN=$(echo | openssl s_client -servername mcp.coupaul.fr -connect mcp.coupaul.fr:443 -showcerts 2>/dev/null | grep -c "BEGIN CERTIFICATE")
if [ $CERT_CHAIN -gt 1 ]; then
    log_success "Chaîne de certificats complète ($CERT_CHAIN certificats)"
else
    log_warning "Chaîne de certificats incomplète ($CERT_CHAIN certificat(s))"
fi

# Test 4: Vérifier les algorithmes de chiffrement
log "Test 4: Vérification des algorithmes de chiffrement"
CIPHER_SUITE=$(echo | openssl s_client -servername mcp.coupaul.fr -connect mcp.coupaul.fr:443 2>/dev/null | grep "Cipher" | head -1)
if [ ! -z "$CIPHER_SUITE" ]; then
    log "Suite de chiffrement: $CIPHER_SUITE"
    log_success "Chiffrement SSL actif"
else
    log_error "Aucune suite de chiffrement détectée"
fi

# Test 5: Vérifier la redirection HTTP vers HTTPS
log "Test 5: Vérification de la redirection HTTP vers HTTPS"
HTTP_RESPONSE=$(curl -I -s --connect-timeout 10 "http://mcp.coupaul.fr" 2>/dev/null | head -1)
if echo "$HTTP_RESPONSE" | grep -q "301\|302"; then
    log_success "Redirection HTTP vers HTTPS configurée"
elif echo "$HTTP_RESPONSE" | grep -q "200"; then
    log_warning "Site accessible en HTTP (pas de redirection HTTPS)"
else
    log_error "Problème de connectivité HTTP"
fi

echo ""
echo "🔧 Solutions recommandées:"
echo "=========================="

# Recommandations basées sur les tests
if ! curl -I -s --connect-timeout 10 "https://mcp.coupaul.fr" > /dev/null 2>&1; then
    echo "1. 🔒 Configurer HTTPS sur votre serveur"
    echo "   - Installer un certificat SSL valide"
    echo "   - Configurer votre serveur web (Nginx/Apache)"
    echo "   - Rediriger HTTP vers HTTPS"
fi

if [ $CERT_CHAIN -le 1 ]; then
    echo "2. 🔗 Installer la chaîne de certificats complète"
    echo "   - Inclure les certificats intermédiaires"
    echo "   - Vérifier la configuration du serveur"
fi

if [ $DAYS_UNTIL_EXPIRY -lt 30 ] 2>/dev/null; then
    echo "3. ⏰ Renouveler le certificat SSL"
    echo "   - Le certificat expire bientôt"
    echo "   - Configurer le renouvellement automatique"
fi

echo ""
echo "4. 🌐 Utiliser Let's Encrypt (gratuit)"
echo "   - Certificats SSL gratuits et automatiques"
echo "   - Renouvellement automatique"
echo "   - Support wildcard avec DNS challenge"

echo ""
echo "5. 🔧 Outils de diagnostic en ligne:"
echo "   - SSL Labs: https://www.ssllabs.com/ssltest/"
echo "   - SSL Checker: https://www.sslshopper.com/ssl-checker.html"
echo "   - Why No Padlock: https://www.whynopadlock.com/"

echo ""
log_success "Diagnostic terminé !"
