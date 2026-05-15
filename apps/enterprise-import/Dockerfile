# F6/F20: build CONTEXT é a RAIZ do monorepo (não a pasta do app), porque o
# worker importa entities de apps/msgops-api por caminho relativo. Construir com:
#   docker build -f apps/enterprise-import/Dockerfile -t enterprise-import .
FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable
# Manifests primeiro (cache de deps)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/enterprise-import/package.json apps/enterprise-import/
COPY apps/msgops-api/package.json apps/msgops-api/
RUN pnpm install --frozen-lockfile --filter enterprise-import...
# Fontes (worker + entities do msgops-api que ele importa)
COPY apps/enterprise-import apps/enterprise-import
COPY apps/msgops-api/src/entities apps/msgops-api/src/entities
COPY apps/msgops-api/src/utils apps/msgops-api/src/utils
WORKDIR /repo/apps/enterprise-import
RUN pnpm build

# webpack (nest-cli compilerOptions.webpack) gera um único dist/main.js com
# todas as deps de código bundladas — runtime só precisa do node_modules.
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /repo/apps/enterprise-import/dist ./dist
COPY --from=builder /repo/apps/enterprise-import/node_modules ./node_modules
COPY --from=builder /repo/apps/enterprise-import/package.json ./
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/main.js"]
