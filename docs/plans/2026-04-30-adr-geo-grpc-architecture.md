# ADR — `@bms/geo` Architecture: gRPC Provider over In-Process MMDB

**Date:** 2026-04-30
**Status:** Accepted
**Linear:** [EVO-956](https://linear.app/evoai/issue/EVO-956)

## Context

Linear EVO-956 ("Fase 7.7 — GeoDB") originally specified the following provider classes inside `packages/geo`:

- `DbIpProvider` — in-process MMDB lookup
- `MaxMindProvider` — in-process MMDB lookup (paid)
- `ApiProvider` — remote HTTP fallback
- `NoopProvider` — disabled

The implementation that landed in PR #22 ships:

- `GrpcGeoProvider` — talks to the existing `apps/geolocation` gRPC service, which itself does the DB-IP MMDB lookup
- `ApiGeoProvider` — HTTP fallback (ip-api.com)
- `NoopGeoProvider` — disabled

`DbIpProvider` and `MaxMindProvider` (as named in the spec) do not exist as classes.

## Decision

Keep MMDB lookup centralized in `apps/geolocation` (already in production) and expose it via gRPC. `@bms/geo` is a thin client package that consumers (event-process today, others later) inject through `GeoModule.register()`.

## Drivers

1. **`apps/geolocation` already exists and serves gRPC.** Reimplementing MMDB lookup as an in-process provider in `packages/geo` would duplicate the loader, the IP validation, the `Traits` mapping, and the MMDB file management. Two code paths to keep in sync.
2. **MMDB file lifecycle is non-trivial.** ~80MB binary, refreshed monthly, bind-mounted from `./data/geo`. Centralizing in one service means one volume, one reader instance per host, one refresh sidecar.
3. **Consumers don't all run on the same host as the MMDB.** event-process runs in its own container; future consumers (tracker, msgops-api) likely too. gRPC is the natural boundary.
4. **MaxMind was aspirational.** Etus uses DB-IP Full in production; MaxMind support was listed as a "future provider" but no code or license to integrate today. Adding a class with no implementation would be dead code.

## Alternatives considered

### A. Match the spec literally — `DbIpProvider` reads MMDB in-process

- **Pro:** matches AC `<2ms` (no gRPC hop).
- **Con:** every consumer container needs the 80MB MMDB bind-mounted, refreshed independently. Loader code duplicated. Memory cost multiplied.
- **Verdict:** rejected — operational complexity not worth the latency savings (gRPC localhost is ~1-2ms in our infra).

### B. Keep `DbIpProvider` as the class name for `GrpcGeoProvider`

- **Pro:** naming matches Linear ticket.
- **Con:** misleading — the class talks gRPC, not DB-IP directly. Future maintainers would expect MMDB I/O inside the class.
- **Verdict:** rejected — naming should describe behavior, not data source.

### C. Add empty `MaxMindProvider` stub for future use

- **Verdict:** rejected — YAGNI. Add when MaxMind license is purchased.

## Consequences

**Positive:**

- Single MMDB instance, single refresh job (`geolocation-refresh` sidecar).
- Consumers depend only on `@bms/geo` (interface) — no MMDB loader, no `mmdb-reader`.
- `GEO_PROVIDER=local` swaps trivially to `api` or `disabled` per-consumer via env.

**Negative:**

- gRPC adds 1-2ms (`<2ms` AC measured in `apps/geolocation` lookup time alone, end-to-end TBD — see Follow-ups).
- Two copies of `geoip.proto` (one in `apps/geolocation/src/`, one in `packages/geo/src/`). Functionally identical today; documented as "fonte de verdade está em `packages/geo`" with a comment in the `apps/geolocation` copy.
- Class names diverge from Linear ticket. Documented here.

## Follow-ups

- [ ] **Benchmark end-to-end latency** (event-process → gRPC → MMDB → response) and confirm `<2ms` AC in production.
- [ ] **Consolidate `geoip.proto`**: have `apps/geolocation` import the proto from `@bms/geo` instead of maintaining its own copy.
- [ ] **`apps/tracker` integration** — Linear scope mentions tracker, but it's a feature (not a fix): which routes need enrichment, which entity persists. To be planned separately.
- [ ] **MaxMind provider** — add when commercial license is acquired.
