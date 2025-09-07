# 🔒 Correction du certificat HTTPS mcp.coupaul.fr

## 📋 Résumé du problème

**Problème identifié :** Le certificat SSL de `mcp.coupaul.fr` est configuré pour `*.up.railway.app` au lieu de votre domaine personnalisé.

**Symptômes :**
- ❌ Connexion HTTPS échoue avec erreur `SEC_E_WRONG_PRINCIPAL`
- ✅ HTTP fonctionne et redirige vers HTTPS
- ✅ Certificat SSL valide mais pour le mauvais domaine
- ✅ DNS résolu correctement vers Railway (66.33.22.103)

## 🔧 Solution recommandée

### Option 1 : Domaine personnalisé Railway (Recommandé)

1. **Connectez-vous à Railway Dashboard**
   - Allez sur https://railway.app
   - Sélectionnez votre projet MCP

2. **Ajoutez le domaine personnalisé**
   - Settings > Domains
   - Cliquez sur "Add Domain"
   - Entrez : `mcp.coupaul.fr`

3. **Configurez les enregistrements DNS**
   - Railway vous donnera des instructions DNS
   - Type : CNAME
   - Nom : `mcp`
   - Valeur : `[URL fournie par Railway]`
   - TTL : 300 (5 minutes)

4. **Attendez la validation**
   - Railway vérifiera automatiquement le domaine
   - Un certificat SSL sera généré automatiquement
   - Processus : 5-15 minutes

## 🧪 Vérification

Une fois configuré, testez avec :

```bash
# Vérifier la connectivité HTTPS
curl -I https://mcp.coupaul.fr

# Vérifier le certificat
echo | openssl s_client -servername mcp.coupaul.fr -connect mcp.coupaul.fr:443 2>/dev/null | openssl x509 -noout -text | grep -A 1 "Subject Alternative Name"
```

Le certificat devrait maintenant montrer :
```
Subject Alternative Name: 
    DNS:mcp.coupaul.fr
```

## 📁 Scripts disponibles

- `scripts/fix-ssl-certificate.sh` - Diagnostic complet
- `scripts/check-dns-config.sh` - Vérification DNS
- `scripts/fix-railway-domain.sh` - Instructions Railway
- `scripts/verify-ssl-fix.sh` - Vérification après correction
- `scripts/setup-letsencrypt.sh` - Configuration Let's Encrypt (alternative)

## 🌐 Alternatives

### Option 2 : Domaine Railway par défaut
- Utilisez `https://votre-projet.up.railway.app`
- Configurez une redirection DNS

### Option 3 : Let's Encrypt sur VPS
- Déployez sur un serveur VPS
- Utilisez le script `setup-letsencrypt.sh`

## ✅ Résultat attendu

Une fois corrigé :
- ✅ HTTPS fonctionne sur `https://mcp.coupaul.fr`
- ✅ Certificat SSL valide pour le bon domaine
- ✅ Site accessible en toute sécurité
- ✅ Smithery peut scanner le serveur MCP

---

**💡 Conseil :** Utilisez l'Option 1 (domaine personnalisé Railway) - c'est la solution la plus simple et fiable.
