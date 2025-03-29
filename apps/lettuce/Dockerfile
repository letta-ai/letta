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


# Production image, copy all the files and run next
FROM base AS lettuce
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeserver

RUN mkdir -p /app
RUN chown -R nodeserver:nodejs /app

COPY ./apps/lettuce /app/apps/lettuce
COPY ./libs/ /app/libs
COPY ./tsconfig.base.json /app/tsconfig.base.json
COPY --from=deps --chown=nodeserver:nodejs /app ./

ENTRYPOINT ["npx", "ts-node", "apps/lettuce/src/main.ts", "--project", "tsconfig.base.json", "--transpile-only"]
