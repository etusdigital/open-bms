// Internal type aliases — structural shapes of what the segment query
// generator needs from caller-owned objects. Kept minimal so the package
// stays decoupled from the TypeORM entity / DTO classes in app code.

export enum FieldsType {
  text = 'value',
  date = 'time',
  number = 'number',
}

export enum InterationEmailTypes {
  OPEN = 'last_open_date',
  CLICK = 'last_click_date',
  SEND = 'last_sent_date',
  DELIVERED = 'last_delivered_date',
}

export type ExternalQueryStep = {
  tableName: string;
  query: string;
  filterType?: string;
};

export type GenerateResult = {
  query: string;
  externalQuerySteps: ExternalQueryStep[] | null;
};

export type TagLike = {
  id: number;
  accountId: number;
};

export type SegmentDtoLike = {
  steps: any[][];
  addBounced?: boolean;
  addInvalid?: boolean;
  addUnsubscribed?: boolean;
  contactsLimit?: number;
};

// Deps for V1 generator. `timeZone` is the account's time_zone config value
// (caller resolves via `account.configByName('time_zone')?.value`).
export type GenerateDepsV1 = {
  timeZone: string | undefined;
};

// Deps for V2 generator. `siblingAccounts` is the pre-resolved list of
// account IDs that should appear in `account_id IN (...)` clauses for
// ClickHouse queries (caller resolves from a `migrationAccounts` map keyed
// by `tag.accountId`). Typed as `number[] | undefined` so callers can pass
// the raw map lookup; passing undefined matches the original behaviour
// (TypeError on `.join`) when the account is not in the map.
export type GenerateDepsV2 = {
  timeZone: string | undefined;
  siblingAccounts: number[] | undefined;
};

// Deps for the dispatcher. Carries enough to pick V1 vs V2 and resolve V2
// inputs.
export type GenerateDeps = {
  timeZone: string | undefined;
  v2Accounts: number[];
  v2SiblingAccountsByAccountId: Record<number, number[]>;
};
