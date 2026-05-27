import { generateSegmentQueryV1 } from './generator-v1';
import { generateSegmentQueryV2 } from './generator-v2';
import { V2_ACCOUNTS, V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID } from './migration-accounts';
import { GenerateDeps, GenerateResult, SegmentDtoLike, TagLike } from './types';

export { generateSegmentQueryV1 } from './generator-v1';
export { generateSegmentQueryV2 } from './generator-v2';
export { V2_ACCOUNTS, V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID } from './migration-accounts';
export { parseEventType } from './parse-event-type';
export { FieldsType, InterationEmailTypes } from './types';
export type { ExternalQueryStep, GenerateDeps, GenerateDepsV1, GenerateDepsV2, GenerateResult, SegmentDtoLike, TagLike } from './types';

// Dispatcher: picks V2 when `tag.accountId` is in `deps.v2Accounts`,
// otherwise V1. Resolves V2's sibling-account list from
// `deps.v2SiblingAccountsByAccountId` keyed by `tag.accountId`.
//
// Semantic note (2026-04-29 refactor): the original producer-side
// dispatch in `msgops-api` keyed off `cls.get('accountId')` (the request
// principal). Since the worker (tag-process) has no CLS context, this
// shared dispatcher keys off `tag.accountId` (the segment owner). For
// any segment created by its own owner — the only path the existing UI
// produces — the two coincide. Cross-account creation by super_admins
// (rare) now routes V1/V2 by the segment owner instead of the actor;
// this is the correct semantics for derived data and was a deliberate
// trade-off for moving generation into the consumer.
export function generateSegmentQuery(tag: TagLike, segmentDto: SegmentDtoLike, deps: GenerateDeps): GenerateResult {
  if (deps.v2Accounts.includes(tag.accountId)) {
    const siblings = deps.v2SiblingAccountsByAccountId[tag.accountId];
    return generateSegmentQueryV2(tag, segmentDto, { timeZone: deps.timeZone, siblingAccounts: siblings });
  }
  return generateSegmentQueryV1(tag, segmentDto, { timeZone: deps.timeZone });
}

// Convenience: dispatcher pre-bound with the canonical migration-account
// state from this package. Use this in consumers (msgops-api producer,
// tag-process worker) so the V1/V2 routing data lives in exactly one
// place.
export function generateForSegment(tag: TagLike, segmentDto: SegmentDtoLike, timeZone: string | undefined): GenerateResult {
  return generateSegmentQuery(tag, segmentDto, {
    timeZone,
    v2Accounts: V2_ACCOUNTS,
    v2SiblingAccountsByAccountId: V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID,
  });
}
