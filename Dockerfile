# Supabase MCP Server - Dockerfile simplifié pour Smithery
FROM python:3.12-slim

# Variables d'environnement essentielles
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Répertoire de travail
WORKDIR /app

# Installation des dépendances système minimales
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copie du code source
COPY src/ ./src/

# Point d'entrée
CMD ["python", "src/supabase_server.py"]
