# Repository Guidelines

## Project Structure & Module Organization
The NestJS application boots from `src/main.ts` and is wired together in `src/app.module.ts`. Domain logic lives in `src/msgops`, where `msgops.module.ts` exposes services and entities under `src/msgops/entities`. Shared request plumbing is split across `src/decorators`, `src/filters`, `src/guards`, and `src/middlewares`; add cross-cutting code there rather than inside controllers. External integrations belong in `src/providers` (for example `pubsub.provider.ts`), and browser assets stay under `src/web`. Unit-level specs co-locate with the code they cover, while end-to-end tests reside in `test/`.

## Build, Test, and Development Commands
Install dependencies with `yarn install`. Use `yarn start:dev` for hot-reload during API development, and `yarn start:prod` to boot the compiled app from `dist/`. Run `yarn build` before deploying to ensure TypeScript compiles cleanly. Lint and format changes with `yarn lint` and `yarn format` prior to opening a pull request.

## Coding Style & Naming Conventions
Code is written in TypeScript with 2-space indentation. Follow NestJS naming patterns (`*.module.ts`, `*.service.ts`, `*.controller.ts`) and keep exported classes in PascalCase, methods in camelCase, and DTOs suffixed with `Dto`. Prettier and ESLint enforce the shared style; avoid manual edits that contradict the automated output. Prefer dependency injection over manual instantiation to keep modules testable.

## Testing Guidelines
Jest runs both unit and e2e suites. Name unit specs `*.spec.ts` next to the source and e2e suites `*.e2e-spec.ts` under `test/`. Run `yarn test` before committing, `yarn test:cov` to review coverage, and `yarn test:e2e --runInBand` when verifying contract changes. New features should include at least one unit spec, and bug fixes should reproduce the regression in a failing test first.

## Commit & Pull Request Guidelines
The repository follows Conventional Commits (`fix:`, `refactor:`, `chore:`) as seen in `git log --oneline`; use the same prefixes and keep subjects under 72 characters. Each commit should be scoped to a single concern so reviewers can bisect easily. Pull requests must describe the change, link any tracker ticket, and note configuration or data migrations. Include curl or HTTPie examples when you add or modify endpoints to help QA validate the change.

## Environment & Configuration
Configuration is driven by `.env` and `ConfigModule.forRoot()`. Set `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` for rate limiting, and provide `SERVICE_ACCOUNT` (JSON string) so `PubSubProvider` can publish in production. Local runs default to mock Pub/Sub responses when `NODE_ENV` is not `production`, but other services expect valid credentials. Never commit secrets; add sample keys to `.env.example` if new settings are required.

