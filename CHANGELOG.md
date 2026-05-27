# Changelog

All notable changes to Open BMS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial open-source release of the BMS platform under Etus Media Holding LTDA.
- Apache 2.0 LICENSE, NOTICE, SECURITY policy, Code of Conduct and
  Trademark policy.
- GitHub issue and PR templates.
- `infra/swarm/` Portainer-ready Swarm deploy guide (`DEPLOY.md`),
  generic `stack.bms.yml`, hardened `stack.traefik.yml` and
  `secrets.env.example` template.
- CSV email reconciliation step in the super-admin import flow to recover
  raw emails from a BMS Enterprise CSV export (workaround for the upstream
  API returning masked addresses).
- Recent imports list on the super-admin Import page.

### Fixed

- Segment builder no longer persists `undefined` operators for `Email
válido` and `Communication channels` fields — both the UI default and
  legacy DB rows are now backfilled. Worker `tag-process` no longer crashes
  in a loop on these segments.

### Changed

- Default Docker registry references migrated from `evoapicloud` to
  `etusdigital`.
- Repository moved to `github.com/etusdigital/open-bms`.

---

Older history is preserved in the git log of the internal predecessor
repository and is not duplicated here.
