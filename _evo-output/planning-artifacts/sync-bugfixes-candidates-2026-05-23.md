5c7c98c1f | 2026-05-21 | fix(click-tracker): declare ENABLE_TRACKER_REDIRECT_EVENT in env.production
e282cadb9 | 2026-05-21 | fix(msgops-api): cast $2 to int in getCampaignsByTag (segment-filter 500)
b5c7eddfe | 2026-05-21 | fix(msgops-api): drop tag/customField regex from contact-imports validators
42b8fec61 | 2026-05-20 | fix(msgops-api): restore canonical contact field set in contact-imports whitelist
3e8979f93 | 2026-05-20 | fix(ci): allow manual production deploy without a release tag
446ec6f9e | 2026-05-19 | fix(ci): fix coverage badges workflow failures
c8a2dbd98 | 2026-05-19 | fix(msgops-api): add idempotent migration for custom_fields.is_system_field
6d2a092be | 2026-05-18 | feat(msgops-api,frontend-react): async contact imports up to 1M (PDBR-146)
b5e68f04b | 2026-05-18 | fix(frontend-react): unblock Save on campaign edit, surface validation errors
fc65c40b3 | 2026-05-18 | fix(frontend-react): show initial message list in campaign content step
6b638c8fa | 2026-05-18 | fix(ci): switch coverage provider to istanbul for workerd compat
6ced15a87 | 2026-05-15 | chore(sre-watcher): narrow claude -p tool surface to silence macOS TCC prompts
4265da4a9 | 2026-05-14 | fix(ci): grant deployments+pull-requests permissions for CF Pages deploys
08c2e0d3b | 2026-05-14 | fix(contacts): orchestrate pagination total from dashboard + countOnly (Vue2 parity)
38314627b | 2026-05-14 | chore: Claude Code agent tooling — investigate-db / block-db-writes / linear-workflow skills + hooks
7af3fbda7 | 2026-05-14 | fix(frontend-react): preserve UTM and suppress false-positive name warnings in campaign edit
609566eec | 2026-05-14 | feat(msgops-api): audit subscriber redesign + user-tracking columns
6fbae3f62 | 2026-05-13 | fix(tag-process): parse next-day scheduleTo in account timezone
4f74461fb | 2026-05-12 | fix(tag-process): enable shutdown hooks to avoid leaking segment locks on SIGTERM
a04a357e2 | 2026-05-12 | fix(segments): release processing lock before callRunTask to stop 503 storm
eeea6e78a | 2026-05-12 | fix(docker): complete @retention/shared build chain in msgops-api and campaign-events-tracker
404a709e8 | 2026-05-11 | fix(docker): copy and build @retention/shared in msgops-api and campaign-events-tracker
f18fb4f7e | 2026-05-11 | fix(ci): exclude release-please squash commit from Turbo affected diff
8a331d9f7 | 2026-05-11 | fix(ci): use github.event.inputs.target in deploy-frontend-react job ifs
4ee01f84c | 2026-05-11 | fix(ci): bind Cloudflare deploys to their GitHub Environment
ed541459e | 2026-05-11 | fix(ci): use github.event.inputs.target in deploy workflow concurrency groups
03140b13a | 2026-05-11 | fix(msgops-api): route GET /contacts/:id through findOneByIdentifier
8c7c3f8ca | 2026-05-11 | fix(ci): add workflow_dispatch escape hatch to release-deploy.yml
f560e0144 | 2026-05-11 | fix(campaigns): respect account timezone in nextOccurrence
065b3bb67 | 2026-05-11 | fix(ci): remove leftover workflow-level permissions in _deploy-cloudrun.yml
35aa1f36e | 2026-05-11 | fix(ci): add provenance permissions to 19 Cloud Run deploy callers
80d7469e5 | 2026-05-11 | fix(segments): atomic processing lock + drop deterministic task names
175e33552 | 2026-05-08 | fix(msgops-api): add name='system' to api-key regen sentinel account
0270aa362 | 2026-05-08 | fix(msgops-api): set priority=transactional attribute on api-key regen publish
19d7ee651 | 2026-05-07 | fix(tag-process): chunk segment payload to avoid 413 on /process-segment-clickhouse
1a369ec53 | 2026-05-07 | fix(backoffice-frontend): coerce undefined Input values to '' to avoid uncontrolled→controlled flip
7a04a7cec | 2026-05-07 | fix(tag-process,msgops-api): address review feedback on segment task dedup
285c734a9 | 2026-05-07 | fix(backoffice-frontend): keep billing month picker top-aligned
8c4f8635a | 2026-05-07 | fix(msgops-api): defensive parse of account_costs in account-usage endpoints
3bf05f6be | 2026-05-07 | fix(msgops-api): stringify non-string account_config values before insert
36b0135fc | 2026-05-06 | fix(msgops-api): stop accounts_usage snapshot chain for soft-deleted accounts
389e1591f | 2026-05-06 | fix(tag-process,msgops-api): dedupe segment Cloud Tasks via deterministic names
5c950a93a | 2026-05-06 | fix(tag-process): skip auto-deactivation for segment-base-size segments
cef5d6145 | 2026-05-01 | fix(send-email): trim trailing hyphens in formatter
8e5a794be | 2026-05-05 | fix(tag-process): skip processing when segment's account is missing or soft-deleted
11ff980ca | 2026-05-05 | fix(frontend-react): default Button type to 'button' to prevent accidental form submits
a79c38f9c | 2026-05-04 | feat(msgops-api,contacts): migrate bulk-unsubscribe from Pub/Sub to Cloud Tasks
f2e9dcc1e | 2026-05-01 | fix(frontend-react): re-enable phased jsx-a11y rules and clear violations
df851e4c8 | 2026-04-30 | fix(email-validation): SQL injection in findByEmail
e5195389c | 2026-04-30 | fix(msgops-api): send CRON_SECRET via Pub/Sub attribute
823098235 | 2026-04-28 | fix(tag-process): remove deprecated isRealTimeSegment gate from auto-inactivation rule
4916f0d8a | 2026-04-28 | fix(automations): send updatedAt on update so the API can reject stale writes
45069be99 | 2026-05-01 | fix(send-email): trim trailing hyphens in formatter
173d8860e | 2026-05-05 | fix(tag-process): skip processing when segment's account is missing or soft-deleted
058b18738 | 2026-05-05 | fix(frontend-react): default Button type to 'button' to prevent accidental form submits
2042a73c2 | 2026-05-04 | feat(msgops-api,contacts): migrate bulk-unsubscribe from Pub/Sub to Cloud Tasks
f90528b50 | 2026-05-01 | fix(frontend-react): re-enable phased jsx-a11y rules and clear violations
77bbf51b9 | 2026-04-30 | fix(email-validation): SQL injection in findByEmail
c5a4e5756 | 2026-04-30 | fix(msgops-api): send CRON_SECRET via Pub/Sub attribute
24ccf7750 | 2026-04-28 | fix(tag-process): remove deprecated isRealTimeSegment gate from auto-inactivation rule
0c1a742c9 | 2026-04-28 | fix(automations): send updatedAt on update so the API can reject stale writes
fc23a557e | 2026-04-28 | fix(ci): update production Cloud Run deploy targets and GCP projects
39cf1fa30 | 2026-04-28 | fix(msgops-api): remove req.user.id fallback from POST /accounts audit
ee33e00d9 | 2026-04-28 | fix(msgops-api): fail-closed audit guard on POST /accounts
5ba6fd1ab | 2026-04-27 | fix(msgops-api): gate webpush GCS upload on isActive
bcdc60da2 | 2026-04-23 | fix(msgops-api): remove duplicate query parser override breaking array limit
502a37022 | 2026-04-23 | fix(tag-process): resolve null contact in conditional trigger evaluation
5647b269d | 2026-04-22 | fix(docker): build @msgops/url-utils workspace dep in send-* and twilio
44445c0d9 | 2026-04-22 | fix(docker): copy workspace package.json files for eslint-config and test-config
04a777236 | 2026-04-21 | fix(event-process): unbreak bot detection by fixing gRPC trait casing
141f96cc2 | 2026-04-21 | fix(ci): verify MMDB checksums post-gunzip; parse month from filename
057755cc4 | 2026-04-20 | fix(ci): use ip-to-location-isp dbType for DB-IP MMDB API
56d675e57 | 2026-04-20 | fix(tracker): use IpAddress decorator for real client IP in /redirect
32ffb1ac6 | 2026-04-17 | fix(event-process): resolve contactId from uuid/email for internal events
6d609c14d | 2026-04-17 | fix(campaigns): open statistics link in new tab