# @msgops/segment-query-builder

DSL → SQL query builder for audience segments. Translates the high-level
segment definition stored in `tags.steps` into a SQL `INSERT INTO segment_process`
statement against Postgres (contacts) and ClickHouse (event-driven conditions).

Used by `apps/tag-process` to recompute segment audiences.

## Usage

```ts
import { generateForSegment } from '@msgops/segment-query-builder';

const { query, externalQuerySteps } = generateForSegment(
  { id: tag.id, accountId: tag.accountId },
  { steps: tag.steps, addBounced, addUnsubscribed, addInvalid },
  accountTimeZone,
);
```

Two generators are available (`generator-v1.ts` / `generator-v2.ts`) — `v1` is
the production default; `v2` is an in-progress refactor.

## Test

```bash
pnpm --filter @msgops/segment-query-builder test
```
