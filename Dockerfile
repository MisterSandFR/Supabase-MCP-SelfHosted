# SUPABASE MCP OAUTH2 v3.1.0 - DOCKERFILE FINAL
# Configuration Python pure - SANS UV - SANS CONFLIT
FROM python:3.12-slim-bookworm

# Variables d'environnement
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app

# Métadonnées Docker
LABEL org.opencontainers.image.title="Supabase MCP OAuth2 Server"
LABEL org.opencontainers.image.description="Enhanced Edition v3.1 - 54+ MCP tools for Supabase management"
LABEL org.opencontainers.image.version="3.1.0"
LABEL org.opencontainers.image.maintainer="MisterSandFR"

# Répertoire de travail
WORKDIR /app

# Mise à jour du système et installation des dépendances
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copie et installation des dépendances Python
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copie du code source
COPY src/ /app/src/

# Création d'un utilisateur non-root
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

# Passage à l'utilisateur non-root
USER appuser

# Point d'entrée
CMD ["python", "src/supabase_server.py"]
