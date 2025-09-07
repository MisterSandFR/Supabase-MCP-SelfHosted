# Use Python 3.12 slim image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements files
COPY pyproject.toml uv.lock ./

# Install uv for faster Python package management
RUN pip install uv

# Install dependencies using uv
RUN uv sync --frozen --no-dev

# Copy source code
COPY src ./src

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Set Python path
ENV PYTHONPATH=/app

# Entrypoint for MCP server
ENTRYPOINT ["uv", "run", "python", "src/supabase_server.py"]
