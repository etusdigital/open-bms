import { MigrationInterface, QueryRunner } from 'typeorm';

export class createEnterpriseImportTables1778500000000 implements MigrationInterface {
  name = 'createEnterpriseImportTables1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_import_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "account_id" integer NULL,
        "enterprise_source_account_id" integer NULL,
        "scope" varchar(16) NOT NULL,
        "enterprise_base_url" varchar(512) NOT NULL,
        "encrypted_api_key" text NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "progress" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "checkpoint" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "error" text NULL,
        "created_by" integer NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "started_at" timestamptz NULL,
        "finished_at" timestamptz NULL,
        CONSTRAINT "pk_enterprise_import_jobs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "enterprise_import_jobs_status_idx" ON "enterprise_import_jobs" ("status")`);

    // 1 job ativo por conta (account-scope). Para scope=instance account_id é
    // NULL e o partial index abaixo o cobre via WHERE account_id IS NOT NULL,
    // então scope=instance é gerido manualmente pelo controller (gate na
    // service: rejeita se já existe job ativo sem account_id).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uniq_running_job_per_account"
        ON "enterprise_import_jobs" ("account_id")
        WHERE status IN ('pending','running','paused') AND account_id IS NOT NULL
    `);

    // F14: scope=instance não tem account_id, então o índice acima não o cobre.
    // Este garante no DB no máximo 1 job instance ativo (expressão constante),
    // fechando a race check-then-insert da service.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uniq_running_instance_job"
        ON "enterprise_import_jobs" ((scope))
        WHERE status IN ('pending','running','paused') AND scope = 'instance'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "enterprise_id_mappings" (
        "job_id" uuid NOT NULL,
        "entity" varchar(64) NOT NULL,
        "source_id" varchar(64) NOT NULL,
        "new_id" varchar(64) NOT NULL,
        CONSTRAINT "pk_enterprise_id_mappings" PRIMARY KEY ("job_id", "entity", "source_id"),
        CONSTRAINT "fk_enterprise_id_mappings_job"
          FOREIGN KEY ("job_id") REFERENCES "enterprise_import_jobs" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "enterprise_id_mappings_job_entity_idx"
        ON "enterprise_id_mappings" ("job_id", "entity")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "enterprise_id_mappings_job_entity_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "enterprise_id_mappings"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_running_instance_job"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uniq_running_job_per_account"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "enterprise_import_jobs_status_idx"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "enterprise_import_jobs"`);
  }
}
