FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json ./
RUN pnpm pkg delete scripts.prepare

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/twilio-messaging/package.json ./apps/twilio-messaging/
COPY packages/messaging/package.json ./packages/messaging/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/url-utils/package.json ./packages/url-utils/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter msgops-twilio-messaging...

FROM deps AS build
COPY packages/typescript-config ./packages/typescript-config
COPY packages/messaging ./packages/messaging
COPY packages/url-utils ./packages/url-utils
RUN pnpm --filter @msgops/url-utils build
RUN pnpm --filter @bms/messaging build
COPY apps/twilio-messaging/ ./apps/twilio-messaging/
RUN pnpm --filter msgops-twilio-messaging build

FROM build AS deploy
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter msgops-twilio-messaging deploy --legacy --prod /deploy
RUN cp -r /app/apps/twilio-messaging/dist /deploy/dist

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
