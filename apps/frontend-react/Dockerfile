FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/frontend-react/package.json ./apps/frontend-react/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/test-config/package.json ./packages/test-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @msgops/frontend-react... --ignore-scripts

FROM deps AS build
# Vite bakes VITE_* envs at build time. Default /api works under docker-compose
# (nginx proxies /api/* → msgops-api:5001). Override for other deployments:
#   docker build --build-arg VITE_API_URL=https://api.example.com ...
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/test-config/ ./packages/test-config/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY apps/frontend-react/ ./apps/frontend-react/
RUN pnpm --filter @msgops/frontend-react build

FROM nginx:alpine AS production
COPY --from=build /app/apps/frontend-react/dist /usr/share/nginx/html
COPY apps/frontend-react/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
