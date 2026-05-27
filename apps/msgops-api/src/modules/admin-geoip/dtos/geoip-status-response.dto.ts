// Aggregated GeoIP status returned to the Super Admin UI. Combines:
//   - The runtime status from apps/geolocation (gRPC GetStatus RPC)
//   - The persisted wizard choice (system_config `geoip_settings`)
//   - Cache key stats from Redis (best-effort approximate hit rate)
export class GeoIpStatusResponseDto {
  // What the wizard saved. `null` means the wizard step hasn't run yet.
  settings: {
    mode: 'disabled' | 'lite' | 'advanced';
    provider?: 'dbip-full' | 'maxmind' | 'ip-api' | 'ipinfo';
  } | null;

  // Live state of the gRPC service. `null` when geolocation is unreachable.
  runtime: {
    tier: string;
    mmdbPath: string;
    mmdbSizeBytes: number;
    mmdbMtimeMs: number;
    lastReloadAt: string;
    lookupCount: number;
    ready: boolean;
  } | null;

  cache: {
    enabled: boolean;
    keyCount: number;
  };
}
