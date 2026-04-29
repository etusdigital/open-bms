import { generateSegmentQueryV2 } from './generator-v2';
import { SegmentDtoLike, TagLike } from './types';

const tag: TagLike = { id: 200, accountId: 65 };
const timeZone = 'America/Sao_Paulo';
const siblingAccounts = [65, 150, 243];

describe('generateSegmentQueryV2', () => {
  it('throws a descriptive error when siblingAccounts is missing', () => {
    const dto: SegmentDtoLike = { steps: [] };

    expect(() => generateSegmentQueryV2(tag, dto, { timeZone, siblingAccounts: undefined })).toThrow(
      /siblingAccounts missing for accountId=65/,
    );
  });

  it('joins siblings into account_id IN (...) for ClickHouse subqueries', () => {
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
            custom_times_value: 1,
            conditional_times_value: '>=',
          },
        ],
      ],
    };
    const out = generateSegmentQueryV2(tag, dto, { timeZone, siblingAccounts });

    expect(out.externalQuerySteps).toHaveLength(1);
    expect(out.externalQuerySteps![0].query).toContain('FROM user_events_daily_v3 FINAL');
    expect(out.externalQuerySteps![0].query).toContain('account_id IN (65,150,243)');
    expect(out.externalQuerySteps![0].filterType).toBe('email');
    expect(out.query).toContain('ct.email IN (select email from table_segment_view0_200)');
  });

  it('uses SUM(total) HAVING for repeated-event counts in V2', () => {
    const dto: SegmentDtoLike = {
      steps: [
        [
          { type: 'conditionalCard', value: '' },
          {
            type: 'interation',
            event_type: 'email',
            event: 'last_click_date',
            conditional_interation: 'yes',
            time: '7',
            message: { id: 99 },
            custom_times_value: 5,
            conditional_times_value: '>=',
          },
        ],
      ],
    };
    const out = generateSegmentQueryV2(tag, dto, { timeZone, siblingAccounts });

    expect(out.externalQuerySteps![0].query).toContain('GROUP BY email');
    expect(out.externalQuerySteps![0].query).toContain('HAVING SUM(total) >= 5');
    expect(out.query).toContain('DROP TABLE table_segment0_200;');
  });
});
