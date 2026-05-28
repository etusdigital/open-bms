import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Wave 5/6 — webhook handler support tables.
 *
 *  - `whatsapp_message_sends`: maps the Meta `wamid` (returned by sendTemplate)
 *    to the originating BMS send (contact/message/campaign/automation). The
 *    delivery webhook correlates `statuses[].id` to this row. PK on `wamid`
 *    gives O(log n) point lookup, critical because Meta's retry policy breaks
 *    if we don't respond fast.
 *  - `whatsapp_inbound_messages`: persists contact replies (text/button/etc.)
 *    so the timeline can show them. `contact_id` is nullable — the first rule
 *    of the project is to never lose data, even when the sender is unknown.
 *
 * Retention (status updates rarely arrive after 90d; inbound grows with reply
 * volume) is deferred to a future purge job — both tables carry a timestamp
 * index to make that cheap.
 */
export class CreateWhatsappMessageSendsAndInbound1781400000000 implements MigrationInterface {
  private readonly sendsTable = new Table({
    name: 'whatsapp_message_sends',
    columns: [
      { name: 'wamid', type: 'varchar', length: '128', isPrimary: true },
      { name: 'account_id', type: 'integer', isNullable: false },
      { name: 'channel_id', type: 'integer', isNullable: false },
      // contact_id nullable + ON DELETE SET NULL (F3): never erase send history
      // when a contact is deleted (first rule of the project: never lose data).
      { name: 'contact_id', type: 'integer', isNullable: true },
      { name: 'message_id', type: 'integer', isNullable: false },
      { name: 'campaign_id', type: 'integer', isNullable: true },
      { name: 'automation_id', type: 'integer', isNullable: true },
      { name: 'utm_campaign', type: 'varchar', length: '255', isNullable: true },
      { name: 'template_name', type: 'varchar', length: '255', isNullable: true },
      { name: 'to_number', type: 'varchar', length: '32', isNullable: true },
      { name: 'sent_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
      { name: 'delivered_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: true },
      { name: 'read_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: true },
      { name: 'failed_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: true },
      { name: 'failure_code', type: 'integer', isNullable: true },
      { name: 'failure_title', type: 'varchar', length: '255', isNullable: true },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
    ],
    foreignKeys: [
      { columnNames: ['account_id'], referencedTableName: 'accounts', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
      { columnNames: ['channel_id'], referencedTableName: 'whatsapp_channels', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
      { columnNames: ['contact_id'], referencedTableName: 'contacts', referencedColumnNames: ['id'], onDelete: 'SET NULL' },
      { columnNames: ['message_id'], referencedTableName: 'messages', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
      { columnNames: ['campaign_id'], referencedTableName: 'campaigns', referencedColumnNames: ['id'], onDelete: 'SET NULL' },
      { columnNames: ['automation_id'], referencedTableName: 'automations', referencedColumnNames: ['id'], onDelete: 'SET NULL' },
    ],
  });

  private readonly inboundTable = new Table({
    name: 'whatsapp_inbound_messages',
    columns: [
      { name: 'id', type: 'bigint', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'wamid', type: 'varchar', length: '128', isNullable: false },
      { name: 'account_id', type: 'integer', isNullable: false },
      { name: 'channel_id', type: 'integer', isNullable: false },
      { name: 'contact_id', type: 'integer', isNullable: true },
      { name: 'from_number', type: 'varchar', length: '32', isNullable: false },
      { name: 'message_type', type: 'varchar', length: '32', isNullable: false },
      { name: 'text_body', type: 'text', isNullable: true },
      { name: 'context_wamid', type: 'varchar', length: '128', isNullable: true },
      { name: 'raw_payload', type: 'jsonb', isNullable: false },
      { name: 'received_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
    ],
    foreignKeys: [
      { columnNames: ['account_id'], referencedTableName: 'accounts', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
      { columnNames: ['channel_id'], referencedTableName: 'whatsapp_channels', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
      { columnNames: ['contact_id'], referencedTableName: 'contacts', referencedColumnNames: ['id'], onDelete: 'SET NULL' },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.sendsTable, true);
    // Partial indexes can't be expressed via TableIndex `where`, so we keep the
    // simple ones in TableIndex and add the WHERE-filtered ones via raw SQL.
    await queryRunner.createIndex('whatsapp_message_sends', new TableIndex({ name: 'idx_wms_contact', columnNames: ['contact_id'] }));
    await queryRunner.query(`CREATE INDEX idx_wms_account_sent_at ON whatsapp_message_sends (account_id, sent_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_wms_campaign ON whatsapp_message_sends (campaign_id) WHERE campaign_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_wms_automation ON whatsapp_message_sends (automation_id) WHERE automation_id IS NOT NULL`);

    await queryRunner.createTable(this.inboundTable, true);
    await queryRunner.query(`ALTER TABLE whatsapp_inbound_messages ADD CONSTRAINT whatsapp_inbound_messages_wamid_unique UNIQUE (wamid)`);
    await queryRunner.query(`CREATE INDEX idx_wim_account_received_at ON whatsapp_inbound_messages (account_id, received_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_wim_contact ON whatsapp_inbound_messages (contact_id) WHERE contact_id IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX idx_wim_context ON whatsapp_inbound_messages (context_wamid) WHERE context_wamid IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('whatsapp_inbound_messages', true);
    await queryRunner.dropTable('whatsapp_message_sends', true);
  }
}
