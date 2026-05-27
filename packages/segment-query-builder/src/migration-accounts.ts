// Hardcoded V1→V2 migration state ported from `tags.service.ts:27`
// (V1 feature-flag list) and `query-builder.provider.ts:9` (V2
// sibling-accounts map).
//
// Same data both consumers (msgops-api producer-side, tag-process worker)
// need to dispatch identically; centralised here to avoid drift.
//
// Note: the original `query-builder.provider.ts` map also keyed an entry
// for accountId 16 ({16: [16, 19, 6, 5, 10, 1]}), but V1 never routed 16
// to V2 — so that branch was dead code. Removed during extraction; if
// account 16 is ever promoted to V2, add it to V2_ACCOUNTS *and* a fresh
// sibling list here in the same change.
export const V2_ACCOUNTS: number[] = [65, 22, 60, 61];

export const V2_SIBLING_ACCOUNTS_BY_ACCOUNT_ID: Record<number, number[]> = {
  65: [65, 150, 243],
  22: [22, 254],
  60: [60, 159],
  61: [61, 158],
};
