FROM node:22-bullseye AS base

# Install dependencies only when needed
FROM base AS deps
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
