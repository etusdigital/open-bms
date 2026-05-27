# geolocation

gRPC service that resolves IPv4/IPv6 addresses to geographic context (country,
region, city, lat/long) using DB-IP or MaxMind GeoLite2 databases. Consumed
by `event-process` to enrich delivery events.

## Run

```bash
pnpm --filter geolocation dev         # port 50051 (gRPC)
```

The MMDB database lives in `/data/geo` (mounted from the `geo-data` volume in
production). To download or refresh:

```bash
pnpm geo:refresh                      # one-shot, on the host
make geo-refresh-force                # via the running sidecar
```

See [`../../docs/operations/geodb.md`](../../docs/operations/geodb.md) for
licensing notes (DB-IP Lite is CC-BY; Full/MaxMind forbid redistribution).
