# ========================================================
# LifeLine Blood Bank & Donor Network - Production Dockerfile
# ========================================================
FROM node:20-alpine AS base

# Install curl for health check
RUN apk --no-cache add curl

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts

# Copy application source code
COPY backend ./backend
COPY frontend ./frontend
COPY scripts ./scripts
COPY .env.example ./.env.example

# Create uploads directory and set permissions
RUN mkdir -p uploads/donors && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "backend/src/server.js"]

