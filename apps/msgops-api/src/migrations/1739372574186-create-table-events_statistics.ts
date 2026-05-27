import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class createTableEventsStatistics1739372574186 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'events_statistics',
        columns: [
          { name: 'date', type: 'date', isNullable: false },
          { name: 'account_id', type: 'integer', isNullable: false },
          { name: 'event_type', type: 'text', isNullable: false }, // email, sms, web-push, mobile-push, custom-event
          { name: 'type', type: 'text', isNullable: false }, // campaign, automation, transactional
          { name: 'message_id', type: 'integer' },
          { name: 'automation_id', type: 'integer' },
          { name: 'campaign_id', type: 'integer' },
          { name: 'is_test_ab', type: 'boolean', default: false },
          { name: 'event_id', type: 'integer' }, // custom-event id
          { name: 'pool', type: 'text' },
          { name: 'provider', type: 'text' }, // sendgrid, sparkpost, twilio

          // Event counts
          { name: 'processed', type: 'integer', default: 0 },
          { name: 'delivered', type: 'integer', default: 0 },
          { name: 'open', type: 'integer', default: 0 },
          { name: 'unique_open', type: 'integer', default: 0 },
          { name: 'click', type: 'integer', default: 0 },
          { name: 'unique_click', type: 'integer', default: 0 },
          { name: 'bounce', type: 'integer', default: 0 },
          { name: 'spam_report', type: 'integer', default: 0 },
          { name: 'unsubscribe', type: 'integer', default: 0 },
          { name: 'deferred', type: 'integer', default: 0 },
          { name: 'sent', type: 'integer', default: 0 },
          { name: 'close', type: 'integer', default: 0 },

          // JSONB columns
          { name: 'click_position', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'email_provider', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'browser', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'os', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'device', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'country', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'region', type: 'jsonb', default: "'{}'::jsonb" },
        ],
      }),
    );

    // Create indexes
    await queryRunner.query(`
      ALTER TABLE events_statistics 
      ADD CONSTRAINT events_statistics_primary_key 
      UNIQUE NULLS NOT DISTINCT (account_id, date, event_type, type, event_id, message_id, automation_id, campaign_id, is_test_ab);
    `);
    await queryRunner.createIndex('events_statistics', new TableIndex({ name: 'idx_events_statistics_date', columnNames: ['account_id', 'date'] }));
    await queryRunner.createIndex('events_statistics', new TableIndex({ name: 'idx_events_statistics_campaigns', columnNames: ['account_id', 'campaign_id', 'date'] }));
    await queryRunner.createIndex('events_statistics', new TableIndex({ name: 'idx_events_statistics_automations', columnNames: ['account_id', 'automation_id', 'date'] }));
    await queryRunner.createIndex('events_statistics', new TableIndex({ name: 'idx_events_statistics_message_id', columnNames: ['account_id', 'message_id', 'date'] }));
    await queryRunner.createIndex('events_statistics', new TableIndex({ name: 'idx_events_statistics_event_id', columnNames: ['account_id', 'event_id', 'date'] }));
    await queryRunner.createIndex('events_statistics', new TableIndex({ name: 'idx_events_statistics_pool', columnNames: ['account_id', 'pool', 'date'] }));
    await queryRunner.query('CREATE INDEX idx_events_statistics_country ON events_statistics USING GIN (country)');
    await queryRunner.query('CREATE INDEX idx_events_statistics_browser ON events_statistics USING GIN (browser)');
    await queryRunner.query('CREATE INDEX idx_events_statistics_os ON events_statistics USING GIN (os)');
    await queryRunner.query('CREATE INDEX idx_events_statistics_device ON events_statistics USING GIN (device)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('events_statistics');
  }
}
