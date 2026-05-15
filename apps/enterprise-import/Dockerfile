# Worker do import Enterprise → OSS (EVO-1123). Mesmo padrão dos workers do
# monorepo (apps/message-trigger). Auto-contido: tem as próprias entities em
# src/entities (não importa fonte de outro app), build com `nest build` (tsc).
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json ./
# Remove o `prepare` (lefthook install) — precisa de git, ausente na imagem.
RUN pnpm pkg delete scripts.prepare

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/enterprise-import/package.json ./apps/enterprise-import/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter enterprise-import...

FROM deps AS build
COPY apps/enterprise-import/ ./apps/enterprise-import/
RUN pnpm --filter enterprise-import build

FROM build AS deploy
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter enterprise-import deploy --legacy --prod /deploy
RUN cp -r /app/apps/enterprise-import/dist /deploy/dist

FROM node:24-alpine AS production
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY --from=deploy /deploy/package.json ./
COPY --from=deploy /deploy/dist ./dist
COPY --from=deploy /deploy/node_modules ./node_modules
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs
ENV NODE_ENV=production
EXPOSE 3001
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
