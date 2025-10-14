FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV DATABASE_URL=file:/data/dms.db
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS builder

# Copy source code
COPY packages/cli ./packages/cli
COPY packages/server ./packages/server

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Prisma Client
RUN pnpm --filter @dms/server db:generate

RUN pnpm run -r build

# Production stage
FROM base AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S dms -u 1001

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/cli/package.json ./packages/cli/

# Copy built application from builder stage
COPY --from=builder --chown=dms:nodejs /app/packages/server/dist ./packages/server/dist
COPY --from=builder --chown=dms:nodejs /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder --chown=dms:nodejs /app/packages/server/prisma ./packages/server/prisma

# Install production dependencies only
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

RUN mkdir -p /data && chown dms:nodejs /data

WORKDIR /app/packages/server

# Switch to non-root user
USER dms

CMD ["sh", "-c", "pnpm run db:deploy && node dist/index.js"]