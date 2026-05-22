import { generateSegmentQueryV1 } from './generator-v1';
import { SegmentDtoLike, TagLike } from './types';

const tag: TagLike = { id: 100, accountId: 1 };
const timeZone = 'America/Sao_Paulo';

describe('generateSegmentQueryV1', () => {
  it('builds the INSERT scaffold with no steps', () => {
    const dto: SegmentDtoLike = { steps: [] };
    const out = generateSegmentQueryV1(tag, dto, { timeZone });

    expect(out.query).toBe('INSERT INTO segment_process ( );');
    expect(out.externalQuerySteps).toBeNull();
  });

  it('renders a custom_field step inline with no external query', () => {
    const dto: SegmentDtoLike = {
      steps: [
        [
          { type: 'conditionalCard', value: '' },
          {
            type: 'custom_field',
            custom_field_id: 7,
            custom_field_value: 'Gold',
            conditional_custom_field: '=',
            custom_field_type: 'text',
          },
        ],
      ],
    };
    const out = generateSegmentQueryV1(tag, dto, { timeZone });

    expect(out.externalQuerySteps).toBeNull();
    expect(out.query).toContain('SELECT 100, ct.id FROM contacts ct');
    expect(out.query).toContain('ct.account_id = 1 AND ct.is_active');
    expect(out.query).toContain('custom_field_id = 7');
    expect(out.query).toContain("'gold'");
    expect(out.query).toMatch(/;\s*$/);
  });

  it('emits a ClickHouse external step for page_view interactions', () => {
    const dto: SegmentDtoLike = {
      steps: [
        [
          { type: 'conditionalCard', value: '' },
          {
            type: 'interation',
            event_type: 'page_view',
            page_view_filter: 'iLike',
            page_view_value: 'pricing',
            conditional_interation: 'yes',
            time: '7',
            custom_times_value: 1,
            conditional_times_value: '>=',
          },
        ],
      ],
    };
    const out = generateSegmentQueryV1(tag, dto, { timeZone });

    expect(out.externalQuerySteps).toHaveLength(1);
    expect(out.externalQuerySteps![0].tableName).toBe('table_segment_page_view0_100');
    expect(out.externalQuerySteps![0].query).toContain("event = 'page_view'");
    expect(out.externalQuerySteps![0].query).toContain('account_id = 1');
    expect(out.externalQuerySteps![0].query).toContain("'%pricing%'");
    expect(out.query).toContain('ct.id IN (select contact_id from table_segment_page_view0_100)');
  });

  it('aggregates HAVING COUNT for custom_times_value > 1', () => {
    const dto: SegmentDtoLike = {
      steps: [
        [
          { type: 'conditionalCard', value: '' },
          {
            type: 'interation',
            event_type: 'email',
            event: 'last_open_date',
            conditional_interation: 'yes',
            time: '30',
            message: { id: 42 },
            custom_times_value: 3,
            conditional_times_value: '>=',
          },
        ],
      ],
    };
    const out = generateSegmentQueryV1(tag, dto, { timeZone });

    expect(out.externalQuerySteps).toHaveLength(1);
    expect(out.externalQuerySteps![0].query).toContain('GROUP BY contact_id');
    expect(out.externalQuerySteps![0].query).toContain('HAVING COUNT(contact_id) >= 3');
    expect(out.query).toContain('DROP TABLE table_segment0_100;');
  });

  it('defaults the HAVING operator to >= when conditional_times_value is missing (EVO-1423)', () => {
    const dto: SegmentDtoLike = {
      steps: [
        [
          { type: 'conditionalCard', value: '' },
          {
            type: 'interation',
            event_type: 'email',
            event: 'last_open_date',
            conditional_interation: 'yes',
            time: '7',
            message: 'any',
            custom_times_value: 3,
            // conditional_times_value intentionally omitted (segment created before the UI captured it)
          },
        ],
      ],
    };
    const out = generateSegmentQueryV1(tag, dto, { timeZone });

    expect(out.externalQuerySteps![0].query).toContain('HAVING COUNT(contact_id) >= 3');
    expect(out.externalQuerySteps![0].query).not.toContain('undefined');
  });

  it('appends INTERSECT/EXCEPT clauses for tag steps', () => {
    const dto: SegmentDtoLike = {
      steps: [
        [
          { type: 'conditionalCard', value: '' },
          { type: 'tag', tag_id: 99, conditional_tag: 'in' },
          { type: 'tag', tag_id: 88, conditional_tag: 'notIn' },
        ],
      ],
    };
    const out = generateSegmentQueryV1(tag, dto, { timeZone });

    expect(out.query).toContain('INTERSECT');
    expect(out.query).toContain('tag_id IN (99)');
    expect(out.query).toContain('EXCEPT');
    expect(out.query).toContain('tag_id IN (88)');
  });

  it('falls back to UTC when timeZone is undefined', () => {
    const dto: SegmentDtoLike = {
      steps: [
        [
          { type: 'conditionalCard', value: '' },
          {
            type: 'user_field',
            user_field_key: 'created_at_date',
            conditional_user_field: '-',
            user_field_value: '30',
          },
        ],
      ],
    };
    const out = generateSegmentQueryV1(tag, dto, { timeZone: undefined });

    expect(out.query).toContain("AT TIME ZONE 'UTC'");
  });

  it('appends LIMIT clause when contactsLimit is set', () => {
    const dto: SegmentDtoLike = { steps: [], contactsLimit: 5000 };
    const out = generateSegmentQueryV1(tag, dto, { timeZone });

    expect(out.query).toContain('LIMIT 5000');
  });
});
