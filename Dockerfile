FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copier tous les fichiers nécessaires
COPY requirements.txt .
COPY mcp_hub.py .
COPY mcp_servers_config.json .

# Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copier le reste du code source
COPY src/ ./src/

# Créer les dossiers nécessaires
RUN mkdir -p logs

# Exposer le port
EXPOSE 8000

# Variables d'environnement
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Commande de démarrage
CMD ["python", "mcp_hub.py"]