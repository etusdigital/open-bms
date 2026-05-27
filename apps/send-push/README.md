# send-push

Push-notification dispatcher worker — consumes the `send-push.push.send` queue
and sends notifications via FCM (Firebase Cloud Messaging) and web push.

## Run

```bash
pnpm --filter send-push dev           # port 3000
```

FCM credentials are configured in the super-admin UI (stored in
`bms-config-init` volume). Env placeholders in [`.env.example`](./.env.example)
keep boot working without real credentials.
