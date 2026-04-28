// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @microsoft/clarity so we can track calls without needing window.clarity
const mockInit = vi.fn();
const mockConsent = vi.fn();
const mockIdentify = vi.fn();

vi.mock('@microsoft/clarity', () => ({
  default: {
    init: (...args: any[]) => mockInit(...args),
    consent: (...args: any[]) => mockConsent(...args),
    identify: (...args: any[]) => mockIdentify(...args),
  },
}));

describe('clarity helpers', () => {
  beforeEach(() => {
    mockInit.mockReset();
    mockConsent.mockReset();
    mockIdentify.mockReset();
  });

  it('does not initialize in non-production environment', async () => {
    // Default vitest env is "test" (not production), so initClarity should be a no-op
    const { initClarity } = await import('../clarity');
    initClarity();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('does not call identify or consent when not initialized', async () => {
    const { identifyClarityUser, grantClarityConsent } = await import('../clarity');

    identifyClarityUser('user-123');
    grantClarityConsent();

    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockConsent).not.toHaveBeenCalled();
  });
});
