# message-trigger

Automation engine — schedules and fires messages from automation flows (drip
campaigns, event-driven triggers, contact-tag entry triggers). Uses BullMQ for
delayed jobs and recurring schedules.

## Run

```bash
pnpm --filter message-trigger dev     # port 3000
```

Queue topic: `message-trigger.trigger.process`.
