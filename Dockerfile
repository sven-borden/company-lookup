# syntax=docker/dockerfile:1

# Multi-stage build for the Next.js web app in this npm-workspaces monorepo.
# Stages: deps (install) -> builder (compile) -> runner (minimal runtime).
# Only the final "runner" stage ships, so build-time tooling never bloats the image.

ARG NODE_VERSION=22

##############################################
# Base: small Alpine image shared by all stages
##############################################
FROM node:${NODE_VERSION}-alpine AS base
# libc6-compat lets glibc-linked native modules run on Alpine's musl.
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

##############################################
# Deps: install node_modules from lockfile only.
# Copying just the manifests first means this layer is
# cached and reused unless a package.json/lock changes.
##############################################
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/types/package.json ./packages/types/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci

##############################################
# Builder: compile the Next.js standalone bundle
##############################################
FROM base AS builder
# Coolify passes build-time variables as --build-args; unless they are declared
# here they never reach `next build`. Only this stage sees them — the shipped
# "runner" stage gets its values injected at container start instead.
ARG DATABASE_URL
ARG ZEFIX_USERNAME
ARG ZEFIX_PASSWORD
ARG ZEFIX_API_BASE_URL
ENV DATABASE_URL=$DATABASE_URL \
    ZEFIX_USERNAME=$ZEFIX_USERNAME \
    ZEFIX_PASSWORD=$ZEFIX_PASSWORD \
    ZEFIX_API_BASE_URL=$ZEFIX_API_BASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

##############################################
# Runner: minimal production image
##############################################
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output already contains the traced node_modules and server.js.
# Static assets and public/ are copied separately (not included by standalone).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
