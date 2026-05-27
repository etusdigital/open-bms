# send-email

Email dispatcher worker — consumes `send-email.campaign.send` and
`send-email.trigger.process` queues and submits messages to one of the
registered providers: SendGrid, SparkPost, MailerSend, Resend, Amazon SES or
Mandrill. Provider selection happens per-account via `account.accountConfigs.
default_email_provider` with an IP-pool fallback.

## Run

```bash
pnpm --filter send-email dev          # port 3000
```

Env vars: see [`.env.example`](./.env.example). Provider credentials live in
the database (super-admin UI) — placeholders in env vars only prevent the
eager-SDK guard from tripping at boot.

See [`../../docs/operations/email-providers.md`](../../docs/operations/email-providers.md)
for provider setup.
