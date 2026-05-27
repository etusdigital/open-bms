# send-whatsapp

WhatsApp dispatcher worker — consumes the `send-whatsapp.whatsapp.send` queue
and sends messages via Evolution API (an external WhatsApp gateway).

## Run

```bash
pnpm --filter send-whatsapp dev       # port 3000
```

Env vars: see [`.env.example`](./.env.example).
