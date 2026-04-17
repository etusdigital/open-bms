import { MigrationInterface, QueryRunner } from 'typeorm';

export class changeColumnsToTimeStampWithTimeZone1684523120291 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tags 
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE custom_fields 
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE users 
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMP WITH TIME ZONE USING deleted_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE pools
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMP WITH TIME ZONE USING deleted_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE accounts
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMP WITH TIME ZONE USING deleted_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE automations_message
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMP WITH TIME ZONE USING deleted_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE emails_templates
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC',
    ALTER COLUMN deleted_at TYPE TIMESTAMP WITH TIME ZONE USING deleted_at AT TIME ZONE 'UTC'`);

    await queryRunner.query(`ALTER TABLE email_validations
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC'`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    console.log('Do not revert');
  }
}
