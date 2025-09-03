# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev
RUN npm ci || npm install

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build the project
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Entrypoint for MCP server
ENTRYPOINT ["node", "dist/index.js"]
