# ============================================
# Stage 1: Build
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 agclaw && \
    adduser -u 1001 -G agclaw -s /bin/sh -D agclaw

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=agclaw:agclaw /app/dist ./dist
COPY --from=builder --chown=agclaw:agclaw /app/node_modules ./node_modules
COPY --from=builder --chown=agclaw:agclaw /app/package.json ./

# Create data directories
RUN mkdir -p data memory config && \
    chown -R agclaw:agclaw /app

USER agclaw

# Expose default ports
# 18789: AG-Claw Gateway
# 3001: Webchat WebSocket
EXPOSE 18789 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:18789/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
