import { generateForSegment, generateSegmentQuery, V2_ACCOUNTS, V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID } from './index';
import { SegmentDtoLike, TagLike } from './types';

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
const timeZone = 'America/Sao_Paulo';

describe('dispatcher (generateSegmentQuery)', () => {
  it('routes to V1 when tag.accountId is not in v2Accounts', () => {
    const tag: TagLike = { id: 1, accountId: 999 };
    const out = generateSegmentQuery(tag, dto, {
      timeZone,
      v2Accounts: V2_ACCOUNTS,
      v2SiblingAccountsByAccountId: V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID,
    });

    expect(out.externalQuerySteps![0].query).toContain('FROM events_logs_v2');
    expect(out.externalQuerySteps![0].query).not.toContain('user_events_daily_v3');
  });

  it('routes to V2 when tag.accountId is a V2 account', () => {
    const tag: TagLike = { id: 1, accountId: 65 };
    const out = generateSegmentQuery(tag, dto, {
      timeZone,
      v2Accounts: V2_ACCOUNTS,
      v2SiblingAccountsByAccountId: V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID,
    });

    expect(out.externalQuerySteps![0].query).toContain('FROM user_events_daily_v3 FINAL');
    expect(out.externalQuerySteps![0].query).toContain('account_id IN (65,150,243)');
  });

  it('throws if a v2Accounts entry has no sibling map (data drift)', () => {
    const tag: TagLike = { id: 1, accountId: 7 };

    expect(() =>
      generateSegmentQuery(tag, dto, {
        timeZone,
        v2Accounts: [7],
        v2SiblingAccountsByAccountId: {},
      }),
    ).toThrow(/siblingAccounts missing for accountId=7/);
  });
});

describe('generateForSegment (canonical bound dispatcher)', () => {
  it('uses the package-level V2_ACCOUNTS list for routing', () => {
    const v1Tag: TagLike = { id: 1, accountId: 999 };
    const v2Tag: TagLike = { id: 1, accountId: 65 };

    const v1Out = generateForSegment(v1Tag, dto, timeZone);
    const v2Out = generateForSegment(v2Tag, dto, timeZone);

    expect(v1Out.externalQuerySteps![0].query).toContain('FROM events_logs_v2');
    expect(v2Out.externalQuerySteps![0].query).toContain('FROM user_events_daily_v3 FINAL');
  });
});

describe('migration-accounts data integrity', () => {
  it('every V2 account has a sibling list entry', () => {
    for (const accountId of V2_ACCOUNTS) {
      expect(V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID[accountId]).toBeDefined();
      expect(V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID[accountId].length).toBeGreaterThan(0);
    }
  });

  it('every sibling list contains its own primary account', () => {
    for (const accountId of V2_ACCOUNTS) {
      expect(V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID[accountId]).toContain(accountId);
    }
  });
});
