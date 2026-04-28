import { describe, it, expect, beforeEach } from 'vitest';
import { apiClient } from '../api-client';

describe('api-client', () => {
  beforeEach(() => {
    // No-op: api-client has no module-level mutable state to reset.
  });

  it('exports an axios instance with the methods we use', () => {
    expect(apiClient).toBeDefined();
    expect(apiClient.get).toBeInstanceOf(Function);
    expect(apiClient.post).toBeInstanceOf(Function);
    expect(apiClient.put).toBeInstanceOf(Function);
    expect(apiClient.delete).toBeInstanceOf(Function);
  });

  it('sends credentials so the bms_refresh cookie travels with cross-origin requests', () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
  });
});
