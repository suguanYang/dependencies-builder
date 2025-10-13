FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10.15.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/server/ ./packages/server/

# Build the server
WORKDIR /app/packages/server
RUN pnpm run build

# Production stage
FROM node:22-alpine AS production

# Install pnpm
RUN npm install -g pnpm@10.15.1

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S dms -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/server/package.json ./packages/server/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder --chown=dms:nodejs /app/packages/server/dist ./packages/server/dist

# Copy prisma schema and migrations
COPY --chown=dms:nodejs packages/server/prisma ./packages/server/prisma

# Create data directory for persistent storage
RUN mkdir -p /data && chown dms:nodejs /data

# Switch to non-root user
USER dms

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Use SQLite database in persistent volume
ENV DATABASE_URL=file:/data/dms.db

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

# Run database migrations and start server
WORKDIR /app/packages/server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]