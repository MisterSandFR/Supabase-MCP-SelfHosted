#!/bin/bash
# Script de configuration automatique Let's Encrypt pour mcp.coupaul.fr

echo "🔒 Configuration automatique Let's Encrypt"
echo "=========================================="
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

# Vérifier si certbot est installé
log "Vérification de l'installation de Certbot..."
if command -v certbot >/dev/null 2>&1; then
    log_success "Certbot est installé"
else
    log_warning "Certbot n'est pas installé"
    echo "Installation de Certbot..."
    
    # Détecter le système d'exploitation
    if [ -f /etc/debian_version ]; then
        # Ubuntu/Debian
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL
        sudo yum install -y certbot python3-certbot-nginx
    elif [ -f /etc/arch-release ]; then
        # Arch Linux
        sudo pacman -S certbot certbot-nginx
    else
        log_error "Système d'exploitation non supporté pour l'installation automatique"
        echo "Installez Certbot manuellement: https://certbot.eff.org/"
        exit 1
    fi
fi

# Vérifier si Nginx est installé et configuré
log "Vérification de la configuration Nginx..."
if command -v nginx >/dev/null 2>&1; then
    log_success "Nginx est installé"
    
    # Vérifier si le domaine est configuré
    if [ -f "/etc/nginx/sites-available/mcp.coupaul.fr" ] || [ -f "/etc/nginx/conf.d/mcp.coupaul.fr.conf" ]; then
        log_success "Configuration Nginx trouvée pour mcp.coupaul.fr"
    else
        log_warning "Configuration Nginx manquante pour mcp.coupaul.fr"
        echo "Création de la configuration Nginx..."
        
        # Créer la configuration Nginx
        cat > /tmp/mcp.coupaul.fr.conf << 'EOF'
server {
    listen 80;
    server_name mcp.coupaul.fr;
    
    # Redirection temporaire vers HTTPS (sera remplacée par Certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mcp.coupaul.fr;
    
    # Configuration SSL (sera mise à jour par Certbot)
    ssl_certificate /etc/letsencrypt/live/mcp.coupaul.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.coupaul.fr/privkey.pem;
    
    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy vers votre application MCP
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Healthcheck endpoint
    location /health {
        proxy_pass http://localhost:8000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
        
        # Copier la configuration
        if [ -d "/etc/nginx/sites-available" ]; then
            sudo cp /tmp/mcp.coupaul.fr.conf /etc/nginx/sites-available/mcp.coupaul.fr
            sudo ln -sf /etc/nginx/sites-available/mcp.coupaul.fr /etc/nginx/sites-enabled/
        else
            sudo cp /tmp/mcp.coupaul.fr.conf /etc/nginx/conf.d/mcp.coupaul.fr.conf
        fi
        
        # Tester la configuration Nginx
        sudo nginx -t
        if [ $? -eq 0 ]; then
            log_success "Configuration Nginx créée et validée"
            sudo systemctl reload nginx
        else
            log_error "Erreur dans la configuration Nginx"
            exit 1
        fi
    fi
else
    log_warning "Nginx n'est pas installé"
    echo "Installation de Nginx..."
    
    if [ -f /etc/debian_version ]; then
        sudo apt update
        sudo apt install -y nginx
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y nginx
    elif [ -f /etc/arch-release ]; then
        sudo pacman -S nginx
    fi
    
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

# Obtenir le certificat SSL avec Certbot
log "Obtention du certificat SSL avec Let's Encrypt..."
sudo certbot --nginx -d mcp.coupaul.fr --non-interactive --agree-tos --email admin@coupaul.fr

if [ $? -eq 0 ]; then
    log_success "Certificat SSL obtenu avec succès"
    
    # Configurer le renouvellement automatique
    log "Configuration du renouvellement automatique..."
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    log_success "Renouvellement automatique configuré"
    
    # Tester le certificat
    log "Test du certificat SSL..."
    if curl -I -s "https://mcp.coupaul.fr" > /dev/null 2>&1; then
        log_success "HTTPS fonctionne correctement"
    else
        log_warning "HTTPS ne fonctionne pas encore (peut prendre quelques minutes)"
    fi
    
else
    log_error "Échec de l'obtention du certificat SSL"
    echo "Vérifiez que:"
    echo "1. Le domaine mcp.coupaul.fr pointe vers ce serveur"
    echo "2. Le port 80 est accessible depuis l'extérieur"
    echo "3. Aucun pare-feu ne bloque les connexions"
fi

echo ""
echo "🔧 Configuration terminée !"
echo "=========================="
echo "Votre certificat SSL est maintenant configuré pour mcp.coupaul.fr"
echo "Le renouvellement automatique est activé"
echo ""
echo "🌐 Testez votre site: https://mcp.coupaul.fr"
echo "🔍 Vérifiez votre certificat: https://www.ssllabs.com/ssltest/"
