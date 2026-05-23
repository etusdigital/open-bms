#!/usr/bin/env tsx
/**
 * Seed para EVO-1027: cria account fresca, N contatos, message + campanha
 * pointing pro mesmo account. Imprime no stdout, na última linha, um JSON com
 * {accountId, campaignId, messageId, contacts}, pra ser parseado pelo run.sh.
 *
 * Estratégia "campaign sem segmento real":
 *   - runSegment=false, sem tag_id
 *   - campaign.query = 'SELECT id as contact_id FROM contacts WHERE account_id = X AND is_active = true'
 *   - packer.createContactsSend executa esse SQL para popular campaigns_contacts
 *
 * Uso:
 *   pnpm tsx tests/load/evo-1027-bulk-send/seed/seed-campaign.ts --count 1000
 *   pnpm tsx tests/load/evo-1027-bulk-send/seed/seed-campaign.ts --teardown --account 42
 *
 * Flags:
 *   --count N       quantidade de contatos a criar (default 1000)
 *   --batch N       tamanho do batch de insert de contatos (default 1000)
 *   --label STR     sufixo no nome da account (default timestamp)
 *   --dsn URL       PG DSN (default postgres://postgres:postgres@localhost:55432/msgops)
 *   --teardown      apaga account+children e sai
 *   --account N     account_id alvo do teardown
 */
import { Client } from 'pg';
import { createHash, randomUUID } from 'node:crypto';

interface Args {
  count: number;
  batch: number;
  label: string;
  dsn: string;
  teardown: boolean;
  accountId?: number;
  mockBase: string;
  eventReceiverBase: string;
}

function parseArgs(): Args {
  const out: Args = {
    count: 1000,
    batch: 1000,
    label: String(Date.now()),
    dsn: process.env.PG_DSN || 'postgres://postgres:postgres@localhost:55432/msgops',
    teardown: false,
    mockBase: process.env.SENDGRID_MOCK_BASE || 'http://localhost:3010',
    eventReceiverBase: process.env.EVENT_RECEIVER_INTERNAL_BASE || 'http://event-receiver:3011',
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--count') out.count = Number(argv[++i]);
    else if (k === '--batch') out.batch = Number(argv[++i]);
    else if (k === '--label') out.label = argv[++i];
    else if (k === '--dsn') out.dsn = argv[++i];
    else if (k === '--teardown') out.teardown = true;
    else if (k === '--account') out.accountId = Number(argv[++i]);
    else if (k === '--mock-base') out.mockBase = argv[++i];
    else if (k === '--event-receiver-base') out.eventReceiverBase = argv[++i];
  }
  return out;
}

async function teardown(client: Client, accountId: number) {
  // Order matters: leaf tables first to avoid FK violations.
  await client.query('DELETE FROM campaigns_contacts WHERE campaign_id IN (SELECT id FROM campaigns WHERE account_id=$1)', [accountId]);
  await client.query('DELETE FROM campaigns_messages WHERE campaign_id IN (SELECT id FROM campaigns WHERE account_id=$1)', [accountId]);
  await client.query('DELETE FROM campaigns WHERE account_id=$1', [accountId]);
  await client.query('DELETE FROM messages WHERE account_id=$1', [accountId]);
  await client.query('DELETE FROM accounts_configs WHERE account_id=$1', [accountId]);
  await client.query('DELETE FROM contacts WHERE account_id=$1', [accountId]);
  await client.query('DELETE FROM accounts WHERE id=$1', [accountId]);
  console.error(`[seed-campaign] teardown done for account_id=${accountId}`);
}

async function setupSendgridMock(
  client: Client,
  accountId: number,
  mockBase: string,
  eventReceiverBase: string,
): Promise<{ apiKey: string; webhookUrl: string }> {
  // The send-email handler reads `sendgrid_key` from accounts_configs first
  // (apps/send-email/src/handlers/sendgrid/sendGrid.handler.ts:315). The
  // @sendgrid/mail SDK validates that keys start with "SG." — so the global
  // dev placeholder fails. We plant a valid-shaped key per seeded account.
  const apiKey = 'SG.MOCK_LOAD_EVO1027';
  // Webhook URL must be reachable BY sendgrid-mock (inside docker network).
  // sendgrid-mock parses `account=<id>` and routes events to event-receiver.
  const webhookUrl = `${eventReceiverBase}/bms/events?platform=sendgrid&account=${accountId}`;

  await client.query(
    `INSERT INTO accounts_configs (account_id, name, description, value, is_load_config)
     VALUES ($1, 'sendgrid_key', 'EVO-1027 mock key', $2, false),
            ($1, 'sendgrid_webhook_url', 'EVO-1027 mock webhook', $3, false)
     ON CONFLICT (account_id, name) DO UPDATE SET value = EXCLUDED.value`,
    [accountId, apiKey, webhookUrl],
  );

  // Register webhook on the in-memory sendgrid-mock so it fires synthetic
  // delivered/open/click events on /v3/mail/send. The mock accepts any
  // bearer (it stores webhooks keyed by URL).
  const payload = {
    enabled: true,
    url: webhookUrl,
    friendly_name: `load-evo1027-${accountId}`,
    bounce: true,
    click: true,
    deferred: true,
    delivered: true,
    dropped: true,
    open: true,
    processed: true,
    spam_report: true,
    unsubscribe: true,
    group_resubscribe: true,
    group_unsubscribe: true,
  };
  const resp = await fetch(`${mockBase}/v3/user/webhooks/event/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!resp.ok && resp.status !== 409) {
    const text = await resp.text();
    throw new Error(`sendgrid-mock webhook register failed: ${resp.status} ${text}`);
  }
  console.error(`[seed-campaign] sendgrid-mock webhook registered → ${webhookUrl}`);
  return { apiKey, webhookUrl };
}

async function createAccount(client: Client, label: string): Promise<number> {
  const name = `load-evo1027-${label}`.slice(0, 255);
  const res = await client.query<{ id: number }>(
    `INSERT INTO accounts (name, description, is_active)
     VALUES ($1, $2, true) RETURNING id`,
    [name, `EVO-1027 load test account (${label})`],
  );
  return res.rows[0].id;
}

async function insertContacts(client: Client, accountId: number, count: number, batch: number) {
  const cols = [
    'account_id', 'uuid', 'email', 'email_provider', 'first_name', 'hashed_email',
    'is_active', 'is_unsubscribed', 'has_bounced', 'created_at', 'created_at_date',
  ];
  const t0 = Date.now();
  let inserted = 0;
  for (let offset = 0; offset < count; offset += batch) {
    const size = Math.min(batch, count - offset);
    const placeholders: string[] = [];
    const values: any[] = [];
    for (let i = 0; i < size; i++) {
      const id = offset + i;
      const email = `load-${accountId}-${id}@example.com`;
      const row = [
        accountId,
        randomUUID(),
        email,
        'example.com',
        `Load${id}`,
        createHash('sha256').update(email.toLowerCase()).digest('hex'),
        true,
        false,
        false,
        new Date(),
        new Date().toISOString().slice(0, 10),
      ];
      const base = i * cols.length;
      placeholders.push('(' + row.map((_, k) => `$${base + k + 1}`).join(',') + ')');
      values.push(...row);
    }
    await client.query(
      `INSERT INTO contacts (${cols.join(',')}) VALUES ${placeholders.join(',')}
       ON CONFLICT ON CONSTRAINT contact_email_unique DO NOTHING`,
      values,
    );
    inserted += size;
  }
  const dt = Date.now() - t0;
  console.error(`[seed-campaign] inserted ${inserted} contacts in ${dt}ms (${(inserted / (dt / 1000)).toFixed(0)}/s)`);
  return inserted;
}

async function createMessage(client: Client, accountId: number, label: string): Promise<number> {
  // Campos mínimos pro packer não bater contra NULL. Conteúdo é trivial:
  // a sendgrid-mock só conta /v3/mail/send sem inspecionar HTML.
  const res = await client.query<{ id: number }>(
    `INSERT INTO messages (
       account_id, title, name, description, ippool, priority, type, subject,
       preview_text, content, text, from_mail, from_name, is_tested, version, status
     ) VALUES ($1,$2,$3,$4,$5,$6,'email',$7,$8,$9,$10,$11,$12,true,1,'ready')
     RETURNING id`,
    [
      accountId,
      `load-msg-${label}`,
      `load-${label}`.slice(0, 40),
      'EVO-1027 load test message',
      'default',
      'medium',
      'EVO-1027 load test',
      'Load test',
      '<p>Load test</p>',
      'Load test',
      'noreply@example.com',
      'Load Test',
    ],
  );
  return res.rows[0].id;
}

async function createCampaign(client: Client, accountId: number, messageId: number, label: string): Promise<number> {
  // status=1 (qualquer valor numérico não-zero serve; packer não checa).
  // tags=[] e runSegment=false → packer pula processSegment e usa campaign.query.
  // query lê todos contatos ativos da account criada — equivalente a "segmento de N".
  const query = `SELECT id as contact_id FROM contacts WHERE account_id = ${accountId} AND is_active = true`;
  const res = await client.query<{ id: number }>(
    `INSERT INTO campaigns (
       account_id, title, name, description, publisher, schedule_to,
       schedule_to_cloud_task_id, status, spread_sending, sent_contacts, sent_percentage,
       query, steps, tags, type, message_type, send_to_all,
       testab_schedule_to, testab_schedule_end, testab_audience_percent, testab_criteria,
       testab_sent_after_test, testab_last_id, testab_schedule_to_cloud_task_id, testab_schedule_end_cloud_task_id,
       recurrence_count, recurrence_settings, is_rate_limit, is_run_segment, triggers
     ) VALUES (
       $1, $2, $3, $4, 'plusdin', NOW(),
       '', 1, 0, 0, 0,
       $5, '[]'::json, '[]'::json, 'simple', 'email', false,
       NOW(), NOW(), 0, '',
       false, 0, '', '',
       0, '{}'::json, false, false, '{}'::json
     ) RETURNING id`,
    [accountId, `load-camp-${label}`, `load-${label}`.slice(0, 40), 'EVO-1027 load campaign', query],
  );
  const campaignId = res.rows[0].id;

  await client.query(
    `INSERT INTO campaigns_messages (campaign_id, message_id, statistics, winner, result_date)
     VALUES ($1, $2, '{}'::json, false, NOW())`,
    [campaignId, messageId],
  );

  return campaignId;
}

async function main() {
  const args = parseArgs();
  const client = new Client({ connectionString: args.dsn });
  await client.connect();

  if (args.teardown) {
    if (!args.accountId) throw new Error('--teardown requires --account N');
    await teardown(client, args.accountId);
    await client.end();
    return;
  }

  const accountId = await createAccount(client, args.label);
  console.error(`[seed-campaign] account_id=${accountId}`);
  await setupSendgridMock(client, accountId, args.mockBase, args.eventReceiverBase);
  const contacts = await insertContacts(client, accountId, args.count, args.batch);
  const messageId = await createMessage(client, accountId, args.label);
  console.error(`[seed-campaign] message_id=${messageId}`);
  const campaignId = await createCampaign(client, accountId, messageId, args.label);
  console.error(`[seed-campaign] campaign_id=${campaignId}`);

  // Last line of stdout = parseable JSON for the runner.
  process.stdout.write(JSON.stringify({ accountId, campaignId, messageId, contacts }) + '\n');
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
