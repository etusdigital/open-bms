FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json ./

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/msgops-api/package.json ./apps/msgops-api/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/segment-query-builder/package.json ./packages/segment-query-builder/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter msgops-api... --ignore-scripts

FROM deps AS build
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/segment-query-builder/ ./packages/segment-query-builder/
COPY apps/msgops-api/ ./apps/msgops-api/
RUN pnpm pkg delete scripts.prepare
RUN pnpm --filter msgops-api exec pnpm pkg delete scripts.prepare
RUN pnpm --filter @msgops/segment-query-builder build
RUN pnpm --filter msgops-api build

FROM build AS deploy
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter msgops-api deploy --legacy --prod /deploy
RUN cp -r /app/apps/msgops-api/dist /deploy/dist

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
ENV TZ=America/Sao_Paulo
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
