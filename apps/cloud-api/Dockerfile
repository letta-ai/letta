FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy necessary package files
COPY package.json package-lock.json ./
COPY apps/cloud-api/package.json ./apps/cloud-api/

# Install only production dependencies
RUN npm ci --production --ignore-scripts --legacy-peer-deps
# Install specific packages needed for the build
RUN npm install --legacy-peer-deps @ts-rest/express@3.51.0 @ts-rest/react-query@3.51.0 lodash jsonrepair axios @tanstack/react-query

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# Build with external modules
RUN mkdir -p dist/apps/cloud-api && (cd apps/cloud-api && npm run build)

# Production image, copy all the files and run next
FROM base AS cloud-api
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeserver

RUN mkdir -p /app
RUN chown -R nodeserver:nodejs /app

COPY --from=builder --chown=nodeserver:nodejs /app/dist/apps/cloud-api /app
COPY --from=builder --chown=nodeserver:nodejs /app/apps/cloud-api/instrument.js /app
COPY --from=builder --chown=nodeserver:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nodeserver:nodejs /app/package.json /app/package.json

USER nodeserver

EXPOSE 8080
ENV PORT=8080

CMD ["node", "--require", "./instrument.js", "main.js"]
