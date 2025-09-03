# Use official Node.js LTS on Alpine
FROM node:lts-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source files and config
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project
RUN npm run build

# Remove dev dependencies for smaller image
RUN npm prune --production

# Entrypoint for MCP server
ENTRYPOINT ["node", "dist/index.js"]
