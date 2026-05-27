# tracker

Open/click tracking pixel endpoint — receives 1×1 pixel hits and link redirects
from sent emails, then publishes events for `event-process` to enrich. Also
handles unsubscribe and preference center redirects.

## Run

```bash
pnpm --filter tracker dev             # port 3000
```
