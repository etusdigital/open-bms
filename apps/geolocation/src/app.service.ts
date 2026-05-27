// geolocation.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { resolve, dirname, basename, join } from 'path';
import { LocationResponse, GeoIpLookupResult, GeoIpStatus } from './geoip.interface';
import { readFileSync, statSync, watch, FSWatcher } from 'fs';
import MMDBReader from 'mmdb-reader';
import { Address4, Address6 } from 'ip-address';

const DEFAULT_DEBOUNCE_MS = 5000;

// Tier→filename mapping. Mirrored in scripts/download-geodb.sh — keep both
// in sync. Tiers that don't ship an MMDB (api / disabled) are intentionally
// absent: the service skips MMDB load and only the cache path is exercised.
const TIER_FILENAMES: Record<string, string> = {
  lite: 'dbip-city-lite.mmdb',
  full: 'dbip-city-full.mmdb',
  maxmind: 'geolite2-city.mmdb',
};

@Injectable()
export class AppService implements OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private mmdbReader: MMDBReader | null = null;
  private mmdbPath: string | null = null;
  private mmdbSizeBytes = 0;
  private mmdbMtimeMs = 0;
  private lastReloadAt: Date | null = null;
  private lookupCount = 0;
  private watcher: FSWatcher | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;

  constructor() {
    const tier = process.env.GEO_TIER ?? 'lite';
    const filename = TIER_FILENAMES[tier];
    if (!filename) {
      // api / disabled / unknown — no MMDB to load. Lookups will return
      // 'Database not loaded' and the service still answers GetStatus.
      this.logger.log(`geoip_mmdb_skip tier=${tier} (no MMDB load expected)`);
      return;
    }

    const dir = process.env.GEO_MMDB_DIR;
    if (!dir) {
      this.logger.error('GEO_MMDB_DIR is not set — lookups will fail');
      return;
    }

    // Absolute paths bypass __dirname; relative paths resolve against the
    // compiled dist/ at runtime (matches the behavior of the previous
    // DBIP_MMDB_PATH contract).
    this.mmdbPath = resolve(__dirname, join(dir, filename));
    this.loadMmdb();
    this.startWatcher();
  }

  onModuleDestroy(): void {
    this.stopWatcher();
  }

  getLocation(ip: string): LocationResponse {
    if (!this.mmdbReader || !ip) {
      return this.failure('Database not loaded');
    }

    if (!this.isValidIp(ip)) {
      return this.failure('Invalid IP address format');
    }

    try {
      this.lookupCount++;
      const response = this.mmdbReader.lookup(ip) as GeoIpLookupResult;

      return {
        country: response?.country?.iso_code || '',
        region: response?.subdivisions?.[0]?.iso_code || '',
        city: response?.city?.names?.en || '',
        postalCode: response?.postal?.code || '',
        timezone: response?.location?.time_zone || '',
        latitude: parseFloat(response?.location?.latitude || '0'),
        longitude: parseFloat(response?.location?.longitude || '0'),
        success: true,
        traits: {
          asn: response?.traits?.autonomous_system_number ?? 0,
          asnOrg: response?.traits?.autonomous_system_organization ?? '',
          isp: response?.traits?.isp ?? '',
          organization: response?.traits?.organization ?? '',
          userType: response?.traits?.user_type ?? '',
          connectionType: response?.traits?.connection_type ?? '',
          isAnycast: response?.traits?.is_anycast ?? false,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error looking up IP ${ip}: ${errorMsg}`);
      return this.failure(`Failed to lookup IP: ${errorMsg}`);
    }
  }

  getStatus(): GeoIpStatus {
    return {
      tier: process.env.GEO_TIER ?? 'lite',
      mmdbPath: this.mmdbPath ?? '',
      mmdbSizeBytes: this.mmdbSizeBytes,
      mmdbMtimeMs: this.mmdbMtimeMs,
      lastReloadAt: this.lastReloadAt ? this.lastReloadAt.toISOString() : '',
      lookupCount: this.lookupCount,
      ready: this.mmdbReader !== null,
    };
  }

  private loadMmdb(): boolean {
    if (!this.mmdbPath) return false;
    try {
      const stats = statSync(this.mmdbPath);
      const buffer = readFileSync(this.mmdbPath);
      this.mmdbReader = new MMDBReader(buffer);
      this.mmdbSizeBytes = stats.size;
      this.mmdbMtimeMs = stats.mtimeMs;
      this.lastReloadAt = new Date();
      this.logger.log(`geoip_mmdb_loaded path=${this.mmdbPath} size=${stats.size} mtime=${stats.mtime.toISOString()}`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to load MMDB at ${this.mmdbPath}: ${errorMsg}`);
      return false;
    }
  }

  // Watch the directory (not the file) so atomic rename + recreate by the
  // download-geodb.sh sidecar still triggers events. fs.watch on the file
  // path itself loses the inode after `mv`. Debounce reload until the file
  // size has been stable for DEFAULT_DEBOUNCE_MS to avoid reading mid-write.
  private startWatcher(): void {
    if (!this.mmdbPath) return;
    if (process.env.GEO_WATCH_ENABLED === 'false') {
      this.logger.log('geoip_mmdb_watch_disabled GEO_WATCH_ENABLED=false');
      return;
    }

    const dir = dirname(this.mmdbPath);
    const file = basename(this.mmdbPath);

    try {
      this.watcher = watch(dir, (_event, changedFile) => {
        if (changedFile && changedFile !== file) return;
        this.scheduleReload();
      });
      this.logger.log(`geoip_mmdb_watch_started dir=${dir} file=${file}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`geoip_mmdb_watch_failed ${errorMsg} — running without auto-reload`);
    }
  }

  private stopWatcher(): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private scheduleReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    const debounceMs = this.parseDebounceMs();
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      if (!this.mmdbPath) return;
      try {
        const stats = statSync(this.mmdbPath);
        if (stats.mtimeMs === this.mmdbMtimeMs && stats.size === this.mmdbSizeBytes) {
          return; // No-op: identical to currently-loaded file.
        }
        if (this.loadMmdb()) {
          this.logger.log(
            `geoip_mmdb_reloaded size=${this.mmdbSizeBytes} mtime=${new Date(this.mmdbMtimeMs).toISOString()}`,
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`geoip_mmdb_reload_skipped ${errorMsg}`);
      }
    }, debounceMs);
  }

  private parseDebounceMs(): number {
    const raw = process.env.GEO_WATCH_DEBOUNCE_MS;
    if (!raw) return DEFAULT_DEBOUNCE_MS;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_DEBOUNCE_MS;
  }

  private failure(error: string): LocationResponse {
    return {
      country: '',
      region: '',
      city: '',
      postalCode: '',
      timezone: '',
      latitude: 0,
      longitude: 0,
      success: false,
      error,
    };
  }

  private isValidIp(ip: string): boolean {
    if (Address4.isValid(ip)) {
      return true;
    }

    if (Address6.isValid(ip)) {
      return true;
    }

    return false;
  }
}
