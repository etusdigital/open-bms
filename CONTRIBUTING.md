# Contributing to Open BMS

Thanks for your interest in contributing to Open BMS! This document outlines
how to contribute effectively.

## Code of Conduct

All contributors are expected to uphold our
[Code of Conduct](./CODE_OF_CONDUCT.md). Harassment, discrimination or abusive
behavior will not be tolerated.

## How to Contribute

### Reporting Bugs

1. Check existing [issues](https://github.com/etusdigital/open-bms/issues)
   to avoid duplicates.
2. Open a new issue using the **Bug report** template with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, deployment target)
   - Logs or screenshots when relevant

### Suggesting Features

1. Open an issue using the **Feature request** template describing:
   - The problem you're trying to solve
   - Your proposed solution
   - Alternatives you considered
2. Wait for maintainer feedback before starting implementation on anything
   non-trivial.

### Submitting Pull Requests

1. Fork the repository.
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes following the project's coding standards.
4. Write or update tests for your changes.
5. Ensure all checks pass locally:
   ```bash
   pnpm type-check
   pnpm lint
   pnpm test
   ```
6. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add new feature
   fix: resolve bug in X
   docs: update README
   refactor: simplify Y
   test: add coverage for Z
   chore: bump dependency
   ```
7. Push to your fork and open a PR against `main`.
8. Fill out the PR template with context, testing notes and screenshots if
   applicable.

## Development Setup

See [README.md](./README.md) for project-specific setup instructions.

Quick start:

```bash
pnpm install
docker compose up -d   # boot infra (Postgres, ClickHouse, RabbitMQ, Redis, MinIO)
pnpm dev               # watch mode for all apps
```

## Code Standards

- Follow the existing code style of the package you're touching.
- Run `pnpm lint` and `pnpm type-check` before pushing.
- Add tests for new features and bug fixes.
- Document public APIs and non-obvious behavior in comments.
- Keep commits atomic and focused — one logical change per commit.

## Branch Strategy

- `main` — production-ready code.
- `feat/*`, `fix/*`, `chore/*`, `docs/*` — short-lived branches off `main`.
- Long-running release branches are not used; releases happen via tags from
  `main`.

## PR Review Checklist

Before requesting review, verify:

- [ ] CI is green (lint, type-check, tests)
- [ ] No `console.log`, debugger statements or commented-out code
- [ ] No secrets, API keys or environment-specific URLs committed
- [ ] Migrations (if any) are reversible or explicitly marked as forward-only
- [ ] Public-facing API changes are documented in the relevant `docs/` file
- [ ] Breaking changes are called out in the PR description

## Licensing of Contributions

By contributing, you agree that your contributions will be licensed under the
Apache License 2.0 (see [LICENSE](./LICENSE)). Trademarks and brand assets are
governed separately by [TRADEMARKS.md](./TRADEMARKS.md).

## Security

If you find a security vulnerability, **do not open a public issue**. Follow
the process in [SECURITY.md](./SECURITY.md).

## Questions?

- **Website**: [etus.com.br/open-bms](https://etus.com.br/open-bms)
- **GitHub Discussions**: [github.com/etusdigital/open-bms/discussions](https://github.com/etusdigital/open-bms/discussions)

Thanks for helping make Open BMS better!

---

© 2026 Etus Media Holding LTDA
