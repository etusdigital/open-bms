# twilio-messaging

SMS / voice dispatcher worker — consumes the `event-process.event.received.
twilio` queue and sends messages via Twilio's API.

## Run

```bash
pnpm --filter twilio-messaging dev    # port 3000
```

Twilio credentials are configured per-account in the super-admin UI. Env vars:
see [`.env.example`](./.env.example).
