import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// Selective re-import: which pipeline steps a job should run. NULL = full
// pipeline (backward compatible with existing rows and full imports).
export class addSelectedStepsToEnterpriseImportJobs1778900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('enterprise_import_jobs', new TableColumn({ name: 'selected_steps', type: 'jsonb', isNullable: true }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('enterprise_import_jobs', 'selected_steps');
  }
}
