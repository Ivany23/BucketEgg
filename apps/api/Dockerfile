# API NestJS em contentor (Railway, Render, Fly.io, Google Cloud Run, ECS...).
# Construir a partir de apps/api:   docker build -t bucketegg-api .
# Migrações (antes de cada deploy): docker run --rm --env-file .env bucketegg-api npx prisma migrate deploy

# Debian slim (glibc): binários pré-compilados do Prisma e do bcrypt funcionam sem compilar nada.
FROM node:24-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_LOCAL_DIR=/app/storage \
    # bcrypt e zlib usam a threadpool do libuv: mais threads = mais logins/compressões em paralelo.
    UV_THREADPOOL_SIZE=8
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
