# Nouveau Dockerfile pour forcer Railway rebuild
FROM python:3.11-slim

# Variables d'environnement
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Répertoire de travail
WORKDIR /app

# Installer curl pour health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copier requirements.txt
COPY requirements.txt .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY src/ ./src/

# Exposer le port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Commande de démarrage - NOUVEAU SERVEUR SIMPLE
CMD ["python", "src/supabase_server_simple.py"]

# Timestamp unique pour forcer rebuild
# Build: $(date +%s)
