import { Trend, Gauge, Counter } from 'k6/metrics';

// Custom metrics exposed by k6's summary + JSON output. Sidecar processes
// (see _shared/metrics/) write parallel CSVs that the report script merges
// against these on timestamp.
export const bullQueueDepth = new Gauge('bull_queue_depth');
export const containerRamMb = new Gauge('container_ram_mb');
export const containerCpuPct = new Gauge('container_cpu_pct');
export const businessLatency = new Trend('business_latency_ms', true);
export const businessErrors = new Counter('business_errors');
