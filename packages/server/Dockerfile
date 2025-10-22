FROM ubuntu:24.04 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV DATABASE_URL=file:/data/dms.db

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y curl

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

RUN apt-get install -y nodejs git build-essential make

RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS builder

# Copy source code
COPY packages/cli ./packages/cli
COPY packages/server ./packages/server

# get codeql bundle
RUN tar -xzf packages/cli/release/codeql-bundle-linux64.tar.gz -C /usr/local

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Prisma Client
RUN pnpm --filter @dms/server db:generate

RUN pnpm run -r build

# Production stage
FROM base AS production

# Create app user
RUN groupadd --gid 1001 nodejs && \
    useradd --system --uid 1001 --create-home --gid nodejs dms

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/cli/package.json ./packages/cli/

# Copy built application from builder stage
COPY --from=builder --chown=dms:nodejs /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder --chown=dms:nodejs /app/packages/cli/qls ./packages/cli/qls
COPY --from=builder --chown=dms:nodejs /app/packages/cli/scan ./packages/cli/scan
COPY --from=builder --chown=dms:nodejs /app/packages/server/dist ./packages/server/dist
COPY --from=builder --chown=dms:nodejs /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder --chown=dms:nodejs /usr/local/codeql /usr/local/codeql

# Install production dependencies only
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

RUN mkdir -p /data /data/dms_local && chown -R dms:nodejs /data

RUN mkdir -p /var/logs /var/logs/dms_local && chown -R dms:nodejs /var/logs

WORKDIR /app/packages/server

# Switch to non-root user
USER dms

CMD ["sh", "-c", "pnpm run db:deploy && node dist/index.js"]