FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json ./

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/lead-conception/package.json ./apps/lead-conception/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter msgops-service-lead-conception

FROM deps AS build
COPY apps/lead-conception/ ./apps/lead-conception/
RUN pnpm --filter msgops-service-lead-conception build

FROM build AS deploy
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter msgops-service-lead-conception deploy --legacy --prod /deploy
RUN cp -r /app/apps/lead-conception/dist /deploy/dist

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
