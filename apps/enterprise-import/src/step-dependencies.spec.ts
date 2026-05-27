import { expandSelectedSteps, STEP_DEPENDENCIES } from './step-dependencies';

describe('expandSelectedSteps', () => {
  it('returns null for null/empty (full import)', () => {
    expect(expandSelectedSteps(null)).toBeNull();
    expect(expandSelectedSteps([])).toBeNull();
  });

  it('pulls in parents of a child step', () => {
    expect([...expandSelectedSteps(['contact_tags'])!].sort()).toEqual(['contact_tags', 'contacts', 'tags']);
    expect([...expandSelectedSteps(['contact_custom_fields'])!].sort()).toEqual(['contact_custom_fields', 'contacts', 'custom-fields']);
    expect([...expandSelectedSteps(['messages'])!].sort()).toEqual(['campaigns', 'messages']);
  });

  it('keeps a root step as-is', () => {
    expect([...expandSelectedSteps(['tags'])!]).toEqual(['tags']);
  });

  it('dedups overlapping parents across multiple selections', () => {
    expect([...expandSelectedSteps(['contact_tags', 'contact_custom_fields'])!].sort()).toEqual(['contact_custom_fields', 'contact_tags', 'contacts', 'custom-fields', 'tags']);
  });

  it('every dependency target is itself a known step key (no dangling parents)', () => {
    // parents must be real importer names; this guards against typos vs pipeline.
    const known = new Set(['tags', 'custom-fields', 'labels', 'email-templates', 'contacts', 'contact_tags', 'contact_custom_fields', 'automations', 'campaigns', 'messages']);
    for (const parents of Object.values(STEP_DEPENDENCIES)) {
      for (const p of parents) expect(known.has(p)).toBe(true);
    }
  });
});
