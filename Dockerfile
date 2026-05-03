# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build the app
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=/data/boerenbridge.db

# Create data directory
RUN mkdir -p /data

# Copy built output and production deps
COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json

# Expose port
EXPOSE 3000

# Use a volume for persistent SQLite data
VOLUME ["/data"]

CMD ["node", ".output/server/index.mjs"]
