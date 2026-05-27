import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates the new WhatsApp Cloud + EvoHub tables (whatsapp_channels, whatsapp_templates),
 * migrates legacy Evolution rows from `accounts_configs` to disconnected channels,
 * and removes the legacy `whatsapp_*` config keys.
 *
 * After this migration runs, accounts that were using the old Evolution integration
 * MUST reconnect through the new UI (Meta direct OR EvoHub, depending on
 * EVOLUTION_HUB_ENABLED).
 */
export class CreateWhatsappChannelsAndDropEvolutionConfigs1781000000000 implements MigrationInterface {
  private readonly channelsTable = new Table({
    name: 'whatsapp_channels',
    columns: [
      { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'account_id', type: 'integer', isNullable: false },
      { name: 'name', type: 'varchar', length: '255', isNullable: false },
      { name: 'mode', type: 'varchar', length: '16', isNullable: false },
      { name: 'status', type: 'varchar', length: '32', isNullable: false, default: "'pending'" },

      { name: 'waba_id', type: 'varchar', length: '64', isNullable: true },
      { name: 'phone_number_id', type: 'varchar', length: '64', isNullable: true },
      { name: 'display_phone_number', type: 'varchar', length: '32', isNullable: true },

      { name: 'access_token', type: 'text', isNullable: true },
      { name: 'business_id', type: 'varchar', length: '64', isNullable: true },

      { name: 'hub_channel_id', type: 'varchar', length: '64', isNullable: true },
      { name: 'channel_token', type: 'text', isNullable: true },
      { name: 'evolution_hub_meta', type: 'jsonb', isNullable: true },

      { name: 'last_event_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: true },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
    ],
    foreignKeys: [
      {
        columnNames: ['account_id'],
        referencedTableName: 'accounts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  });

  private readonly templatesTable = new Table({
    name: 'whatsapp_templates',
    columns: [
      { name: 'id', type: 'integer', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'account_id', type: 'integer', isNullable: false },
      { name: 'channel_id', type: 'integer', isNullable: false },
      { name: 'slug', type: 'varchar', length: '128', isNullable: false },
      { name: 'locale', type: 'varchar', length: '16', isNullable: false, default: "'pt_BR'" },
      { name: 'category', type: 'varchar', length: '32', isNullable: false },
      { name: 'body_text', type: 'text', isNullable: false },
      { name: 'meta', type: 'jsonb', isNullable: false },
      { name: 'placeholders', type: 'jsonb', isNullable: false, default: "'[]'" },
      { name: 'meta_template_id', type: 'varchar', length: '64', isNullable: true },
      { name: 'meta_status', type: 'varchar', length: '32', isNullable: true },
      { name: 'meta_rejected_reason', type: 'text', isNullable: true },
      { name: 'meta_synced_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: true },
      { name: 'updated_by', type: 'integer', isNullable: true },
      { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
      { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', isNullable: false, default: 'NOW()' },
    ],
    foreignKeys: [
      {
        columnNames: ['account_id'],
        referencedTableName: 'accounts',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
      {
        columnNames: ['channel_id'],
        referencedTableName: 'whatsapp_channels',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      },
    ],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.channelsTable, true);
    await queryRunner.query(`ALTER TABLE whatsapp_channels ADD CONSTRAINT whatsapp_channels_mode_chk CHECK (mode IN ('meta', 'evohub'))`);
    await queryRunner.query(`ALTER TABLE whatsapp_channels ADD CONSTRAINT whatsapp_channels_phone_unique UNIQUE (account_id, phone_number_id)`);
    await queryRunner.createIndex('whatsapp_channels', new TableIndex({ name: 'idx_whatsapp_channels_account', columnNames: ['account_id'] }));
    await queryRunner.createIndex('whatsapp_channels', new TableIndex({ name: 'idx_whatsapp_channels_status', columnNames: ['status'] }));
    await queryRunner.createIndex('whatsapp_channels', new TableIndex({ name: 'idx_whatsapp_channels_mode', columnNames: ['mode'] }));

    await queryRunner.createTable(this.templatesTable, true);
    await queryRunner.query(`ALTER TABLE whatsapp_templates ADD CONSTRAINT whatsapp_templates_slug_locale_unique UNIQUE (channel_id, slug, locale)`);
    await queryRunner.createIndex('whatsapp_templates', new TableIndex({ name: 'idx_whatsapp_templates_account', columnNames: ['account_id'] }));
    await queryRunner.createIndex('whatsapp_templates', new TableIndex({ name: 'idx_whatsapp_templates_status', columnNames: ['meta_status'] }));

    // Best-effort data migration from legacy accounts_configs keys.
    // Skip silently if accounts_configs table does not exist (e.g., fresh installs).
    const hasAccountsConfigs = await queryRunner.hasTable('accounts_configs');
    if (hasAccountsConfigs) {
      await queryRunner.query(`
        INSERT INTO whatsapp_channels (account_id, name, mode, status, phone_number_id, evolution_hub_meta)
        SELECT
          ac1.account_id,
          COALESCE(a.name, 'Canal Migrado (Evolution Legado)'),
          'meta',
          'disconnected',
          ac1.value,
          jsonb_build_object(
            'migrated_from', 'accounts_configs',
            'legacy_business_id', (SELECT value FROM accounts_configs WHERE account_id = ac1.account_id AND name = 'whatsapp_business_id' LIMIT 1),
            'migrated_at', NOW()
          )
        FROM accounts_configs ac1
        JOIN accounts a ON a.id = ac1.account_id
        WHERE ac1.name = 'whatsapp_number_id'
          AND ac1.value IS NOT NULL
          AND ac1.value <> ''
        ON CONFLICT (account_id, phone_number_id) DO NOTHING
      `);

      await queryRunner.query(`
        DELETE FROM accounts_configs
        WHERE name IN ('whatsapp_number_id', 'whatsapp_access_token', 'whatsapp_business_id')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // The DELETE from accounts_configs is one-way: we do NOT attempt to restore
    // the legacy `whatsapp_*` keys on down().
    await queryRunner.dropTable('whatsapp_templates', true);
    await queryRunner.dropTable('whatsapp_channels', true);
  }
}
