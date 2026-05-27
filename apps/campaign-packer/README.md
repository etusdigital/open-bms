# campaign-packer

Campaign batch orchestrator — when a campaign is triggered, expands the
recipient segment into pages and enqueues one job per page on the appropriate
channel queue (`send-email.campaign.send`, etc.). Also handles A/B test
creation and result resolution.

## Run

```bash
pnpm --filter campaign-packer dev     # port 3000
```

The `msgops-api` calls `campaign-packer` over HTTP at
`http://campaign-packer:3000/create-contacts-send/:campaignId` (see
`CAMPAIGN_TRIGGER_ENDPOINT` in the root `.env.example`).
