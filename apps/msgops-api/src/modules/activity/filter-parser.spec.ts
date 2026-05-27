import { buildWhereClauses, FilterParseError, parseActivityQuery } from './filter-parser';

const DEFAULT_OPTS = {
  defaultDays: 7,
  capDays: 90,
  fixedMessageType: 'email',
};

describe('parseActivityQuery', () => {
  it('parses simple tokens', () => {
    const f = parseActivityQuery('account:42 event:open');
    expect(f.tokens).toEqual([
      { key: 'account', values: ['42'], negate: false },
      { key: 'event', values: ['open'], negate: false },
    ]);
  });

  it('parses negation', () => {
    const f = parseActivityQuery('-event:dropped');
    expect(f.tokens[0]).toEqual({ key: 'event', values: ['dropped'], negate: true });
  });

  it('groups repeated positive token into IN', () => {
    const f = parseActivityQuery('event:open event:click');
    expect(f.tokens).toHaveLength(1);
    expect(f.tokens[0].values).toEqual(['open', 'click']);
  });

  it('rejects unknown tokens', () => {
    expect(() => parseActivityQuery('foo:bar')).toThrow(FilterParseError);
  });

  it('rejects empty value', () => {
    expect(() => parseActivityQuery('event:')).toThrow(FilterParseError);
  });
});

describe('buildWhereClauses', () => {
  it('always pins message_type and date partition', () => {
    const { whereSql } = buildWhereClauses(parseActivityQuery(''), DEFAULT_OPTS);
    expect(whereSql).toContain("message_type = 'email'");
    expect(whereSql).toMatch(/time_date >= /);
    expect(whereSql).toMatch(/time_date <= /);
  });

  it('emits account_id = N for single value', () => {
    const { whereSql } = buildWhereClauses(parseActivityQuery('account:42'), DEFAULT_OPTS);
    expect(whereSql).toContain('account_id = 42');
  });

  it('emits event != for negation', () => {
    const { whereSql } = buildWhereClauses(parseActivityQuery('-event:dropped'), DEFAULT_OPTS);
    expect(whereSql).toContain("event != 'dropped'");
  });

  it('emits date bound from after:', () => {
    const { whereSql } = buildWhereClauses(parseActivityQuery('after:2026-05-20'), DEFAULT_OPTS);
    expect(whereSql).toContain("time_date >= '2026-05-20'");
  });

  it('contact: routes email vs id vs uuid into different columns', () => {
    const { whereSql } = buildWhereClauses(parseActivityQuery('contact:foo@bar.com'), DEFAULT_OPTS);
    expect(whereSql).toContain("email IN ('foo@bar.com')");
    const byId = buildWhereClauses(parseActivityQuery('contact:123'), DEFAULT_OPTS);
    expect(byId.whereSql).toContain('contact_id IN (123)');
    const byUuid = buildWhereClauses(parseActivityQuery('contact:abc-xyz'), DEFAULT_OPTS);
    expect(byUuid.whereSql).toContain("uuid IN ('abc-xyz')");
  });

  it('escapes single quotes and backslashes', () => {
    const { whereSql } = buildWhereClauses(parseActivityQuery("provider:o'hai"), DEFAULT_OPTS);
    expect(whereSql).toContain("provider = 'o''hai'");
  });

  it('default range is 7 days', () => {
    const { appliedRange } = buildWhereClauses(parseActivityQuery(''), DEFAULT_OPTS);
    const spanDays = (new Date(appliedRange.before).getTime() - new Date(appliedRange.after).getTime()) / 86_400_000;
    expect(spanDays).toBeGreaterThan(6.9);
    expect(spanDays).toBeLessThan(7.1);
  });

  it('rejects after >= before', () => {
    expect(() => buildWhereClauses(parseActivityQuery('after:2026-05-25 before:2026-05-20'), DEFAULT_OPTS)).toThrow(FilterParseError);
  });

  it('clamps after to 90-day cap', () => {
    const { appliedRange } = buildWhereClauses(parseActivityQuery('after:2020-01-01'), DEFAULT_OPTS);
    const days = (Date.now() - new Date(appliedRange.after).getTime()) / 86_400_000;
    expect(days).toBeLessThanOrEqual(90 + 1);
  });
});
