# Supabase MCP Server - Dockerfile pour Self-Hosting
FROM python:3.12-slim

# Variables d'environnement
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Répertoire de travail
WORKDIR /app

# Installation des dépendances système
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copie du code source
COPY src/ ./src/

# Création d'un utilisateur non-root
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Exposition du port
EXPOSE 3000

# Point d'entrée
CMD ["python", "src/supabase_server.py"]
