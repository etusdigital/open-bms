# enterprise-import

BullMQ worker that imports tags, custom fields, labels, email templates,
contacts, automations, campaigns and messages from a BMS Enterprise API into
the current Open BMS instance.

## Run

```bash
pnpm --filter enterprise-import dev   # port 3001
```

Triggered when an operator submits `POST /accounts/import` on `msgops-api`.
Each import job is persisted in `enterprise_import_jobs`; the worker picks it
up from the `enterprise-import` BullMQ queue and runs the pipeline steps in
order with checkpointing for resume-on-failure.

> ⚠️ **Known limitation**: the Enterprise `/contacts` endpoint returns emails
> masked. The companion **CSV reconcile** step in the super-admin UI lets an
> operator upload a CSV export with raw emails to repair the masked rows
> after import.
