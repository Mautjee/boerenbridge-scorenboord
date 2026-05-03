# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:22-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache libstdc++

# Copy built application from base
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=base /app/src/server/db/schema.ts ./src/server/db/schema.ts
COPY --from=base /app/server-entry.js ./server-entry.js

# Environment
ENV NODE_ENV=production
ENV DATABASE_URL=/data/sqlite.db
ENV PORT=3000

# Create data directory for SQLite
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Run migrations and start
CMD ["sh", "-c", "npx drizzle-kit push && npm start"]
