# Use official Node.js LTS
FROM node:20-slim

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies for build
RUN npm ci --include=dev

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project
RUN npm run build

# Keep all dependencies (don't prune)
# The server needs some runtime dependencies that might be in devDependencies

# Entrypoint for MCP server
ENTRYPOINT ["node", "dist/index.js"]
