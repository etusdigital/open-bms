import { Injectable } from '@nestjs/common';

type CacheType = 'timezone' | 'apiKey' | 'custom_event' | 'userAgent' | 'message_association';

@Injectable()
export class CacheService {
  private static caches: Map<CacheType, Map<string | number, any>> = new Map();
  private static readonly MAX_CACHE_SIZE = 2000;

  constructor() {
    // Initialize caches if they don't exist
    if (!CacheService.caches.has('timezone')) {
      CacheService.caches.set('timezone', new Map());
    }
    if (!CacheService.caches.has('apiKey')) {
      CacheService.caches.set('apiKey', new Map());
    }
    if (!CacheService.caches.has('custom_event')) {
      CacheService.caches.set('custom_event', new Map());
    }
    if (!CacheService.caches.has('userAgent')) {
      CacheService.caches.set('userAgent', new Map());
    }
    if (!CacheService.caches.has('message_association')) {
      CacheService.caches.set('message_association', new Map());
    }
  }

  get<T>(type: CacheType, key: string | number): T | undefined {
    return CacheService.caches.get(type)?.get(key);
  }

  set<T>(type: CacheType, key: string | number, value: T): void {
    const cache = CacheService.caches.get(type);
    if (!cache) return;

    // For userAgent cache, implement size limit
    if (cache.size >= CacheService.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, value);
  }

  clear(type: CacheType): void {
    CacheService.caches.get(type)?.clear();
  }

  clearAll(): void {
    CacheService.caches.forEach((cache) => cache.clear());
  }

  getSize(type: CacheType): number {
    return CacheService.caches.get(type)?.size || 0;
  }
}
