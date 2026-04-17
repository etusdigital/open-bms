FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json ./

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/send-push/package.json ./apps/send-push/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter msgops-send-push

FROM deps AS build
COPY apps/send-push/ ./apps/send-push/
RUN pnpm --filter msgops-send-push build

FROM build AS deploy
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter msgops-send-push deploy --legacy --prod /deploy
RUN cp -r /app/apps/send-push/dist /deploy/dist

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
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
