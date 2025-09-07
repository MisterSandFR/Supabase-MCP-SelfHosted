# Dockerfile pour Supabase MCP OAuth2 v3.1.0
# Configuration Python pure sans uv
FROM python:3.12-slim

# Métadonnées
LABEL maintainer="MisterSandFR"
LABEL version="3.1.0"
LABEL description="Supabase MCP OAuth2 Server"

# Définir le répertoire de travail
WORKDIR /app

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copier le fichier requirements
COPY requirements.txt ./

# Installer les dépendances Python avec pip
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY src ./src

# Créer un utilisateur non-root pour la sécurité
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app

# Passer à l'utilisateur non-root
USER app

# Définir le chemin Python
ENV PYTHONPATH=/app

# Point d'entrée pour le serveur MCP
ENTRYPOINT ["python", "src/supabase_server.py"]
