FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package.json and lock file
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Deps with dev dependencies for migrations
FROM base AS deps-dev
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --production=false

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_PUBLIC_CURRENT_HOST="https://app.letta.com"
ENV NEXT_PUBLIC_MIXPANEL_TOKEN="0790fe817b0407efb691ea896533d3ae"
ENV NEXT_PUBLIC_STRIPE_PUBLISH_KEY="pk_live_51QiNygIITVhFnB4Wq0vmV0wljCqjps1FJZgDEpEQOYBbmpZQt1pgmmngsEQj8JWiUQatbTPweEWXFiKqhEsn0VCq00OZjwM2PE"
ENV NEXT_PUBLIC_POSTHOG_KEY="phc_FzkA3UcqiUXxOiBe3Iuvlh1o5HgAaRpK1FDUvi2zcoR"
ENV NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"


# Disable telemetry during build time
ENV NEXT_TELEMETRY_DISABLED 1

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN) npm run build

# Create a new release
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
        SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN) npx sentry-cli releases new -p letta-web $(npx sentry-cli releases propose-version)

# Upload source maps
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
        SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN) npx sentry-cli releases files --project letta-web -t upload-sourcemaps ./apps/letta/.next/static ./apps/letta/.next/static

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

# Production image, copy all the files and run next
FROM base AS web
WORKDIR /app

ENV NODE_ENV=production

## Preset environment variables
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379

# Disable telemetry during runtime
ENV NEXT_TELEMETRY_DISABLED 1

# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 8080
ENV PORT=8080

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "apps/web/server.js"]

# Migration image
FROM base AS migrations

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .

USER nextjs

CMD ["npm", "run", "web:database:migrate:ci"]
