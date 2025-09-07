#!/bin/bash
# Script de vérification du certificat HTTPS après correction

echo "🔍 Vérification du certificat HTTPS après correction"
echo "===================================================="
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
    HTTPS_WORKING=true
else
    log_error "Impossible de se connecter en HTTPS"
    HTTPS_WORKING=false
fi

# Test 2: Vérifier le certificat SSL
log "Test 2: Vérification du certificat SSL"
CERT_INFO=$(echo | openssl s_client -servername mcp.coupaul.fr -connect mcp.coupaul.fr:443 2>/dev/null | openssl x509 -noout -text 2>/dev/null)

if [ ! -z "$CERT_INFO" ]; then
    log_success "Certificat SSL accessible"
    
    # Vérifier le sujet du certificat
    SUBJECT=$(echo "$CERT_INFO" | grep "Subject:" | head -1)
    log "Sujet du certificat: $SUBJECT"
    
    # Vérifier les noms alternatifs
    SAN=$(echo "$CERT_INFO" | grep -A 1 "Subject Alternative Name" | tail -1)
    log "Noms alternatifs: $SAN"
    
    # Vérifier si mcp.coupaul.fr est dans les noms alternatifs
    if echo "$SAN" | grep -q "mcp.coupaul.fr"; then
        log_success "Certificat configuré pour mcp.coupaul.fr"
        CERT_CORRECT=true
    else
        log_warning "Certificat non configuré pour mcp.coupaul.fr"
        log "Noms dans le certificat: $SAN"
        CERT_CORRECT=false
    fi
    
    # Vérifier la date d'expiration
    EXPIRY_DATE=$(echo | openssl s_client -servername mcp.coupaul.fr -connect mcp.coupaul.fr:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ ! -z "$EXPIRY_DATE" ]; then
        log "Date d'expiration: $EXPIRY_DATE"
    fi
else
    log_error "Impossible d'accéder au certificat SSL"
    CERT_CORRECT=false
fi

# Test 3: Test de l'endpoint /health
log "Test 3: Test de l'endpoint /health"
if [ "$HTTPS_WORKING" = "true" ]; then
    HEALTH_RESPONSE=$(curl -s --connect-timeout 10 "https://mcp.coupaul.fr/health" 2>/dev/null)
    if echo "$HEALTH_RESPONSE" | grep -q "UP\|status"; then
        log_success "Endpoint /health fonctionnel"
    else
        log_warning "Endpoint /health non fonctionnel ou réponse inattendue"
        log "Réponse: $HEALTH_RESPONSE"
    fi
else
    log_warning "Test de /health ignoré (HTTPS non fonctionnel)"
fi

# Test 4: Test de l'endpoint /
log "Test 4: Test de l'endpoint /"
if [ "$HTTPS_WORKING" = "true" ]; then
    ROOT_RESPONSE=$(curl -s --connect-timeout 10 "https://mcp.coupaul.fr/" 2>/dev/null)
    if echo "$ROOT_RESPONSE" | grep -q "Supabase\|MCP\|Server"; then
        log_success "Endpoint / fonctionnel"
    else
        log_warning "Endpoint / non fonctionnel ou réponse inattendue"
        log "Réponse: ${ROOT_RESPONSE:0:100}..."
    fi
else
    log_warning "Test de / ignoré (HTTPS non fonctionnel)"
fi

# Test 5: Vérifier la redirection HTTP vers HTTPS
log "Test 5: Vérification de la redirection HTTP vers HTTPS"
HTTP_RESPONSE=$(curl -I -s --connect-timeout 10 "http://mcp.coupaul.fr" 2>/dev/null | head -1)
if echo "$HTTP_RESPONSE" | grep -q "301\|302"; then
    log_success "Redirection HTTP vers HTTPS configurée"
else
    log_warning "Pas de redirection HTTP vers HTTPS"
fi

echo ""
echo "📊 Résumé des tests:"
echo "===================="

if [ "$HTTPS_WORKING" = "true" ] && [ "$CERT_CORRECT" = "true" ]; then
    log_success "🎉 Certificat HTTPS corrigé avec succès !"
    echo ""
    echo "✅ HTTPS fonctionne correctement"
    echo "✅ Certificat configuré pour mcp.coupaul.fr"
    echo "✅ Site accessible en toute sécurité"
    echo ""
    echo "🌐 Testez votre site: https://mcp.coupaul.fr"
    echo "🔍 Vérifiez votre certificat: https://www.ssllabs.com/ssltest/"
    
elif [ "$HTTPS_WORKING" = "false" ]; then
    log_error "❌ HTTPS ne fonctionne toujours pas"
    echo ""
    echo "🔧 Actions recommandées:"
    echo "1. Vérifiez que le domaine personnalisé est configuré sur Railway"
    echo "2. Attendez 5-15 minutes pour la propagation"
    echo "3. Vérifiez les enregistrements DNS"
    echo "4. Relancez ce script dans quelques minutes"
    
elif [ "$CERT_CORRECT" = "false" ]; then
    log_warning "⚠️ HTTPS fonctionne mais certificat incorrect"
    echo ""
    echo "🔧 Le certificat n'est pas encore configuré pour mcp.coupaul.fr"
    echo "⏰ Attendez que Railway génère le nouveau certificat"
    echo "🔄 Relancez ce script dans 5-10 minutes"
fi

echo ""
log_success "Vérification terminée !"
