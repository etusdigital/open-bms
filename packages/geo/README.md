# @msgops/geo

Shared types and gRPC client helpers for talking to the `geolocation` service.
Used by `event-process` and any other app that needs to enrich an IP with
country / region / city.

## Usage

```ts
import { createGeoClient } from '@msgops/geo';

const client = createGeoClient(process.env.GEO_GRPC_URL);
const result = await client.resolve({ ip: '8.8.8.8' });
```
