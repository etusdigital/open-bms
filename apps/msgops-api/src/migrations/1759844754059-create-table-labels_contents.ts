import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class createTableLabelsContents1759844754059 implements MigrationInterface {
  name = 'createTableLabelsContents1759844754059';

  private table = new Table({
    name: 'labels_contents',
    columns: [
      { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
      { name: 'label_id', type: 'int', isNullable: false },
      { name: 'entity_name', type: 'varchar', isNullable: false },
      { name: 'entity_id', type: 'int', isNullable: false },
    ],
  });

  private foreignKeyLabelsContentsLabelId = new TableForeignKey({
    name: 'fk_labels_contents_label_id',
    columnNames: ['label_id'],
    referencedTableName: 'labels',
    referencedColumnNames: ['id'],
  });

  private indexLabelsContentsEntityNameEntityId = new TableIndex({
    name: 'idx_labels_contents_label_id_entity_name_entity_id',
    columnNames: ['label_id', 'entity_name', 'entity_id'],
  });

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(this.table);
    await queryRunner.createForeignKey(this.table, this.foreignKeyLabelsContentsLabelId);
    await queryRunner.createIndex(this.table, this.indexLabelsContentsEntityNameEntityId);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.table);
    await queryRunner.dropForeignKey(this.table, this.foreignKeyLabelsContentsLabelId);
    await queryRunner.dropIndex(this.table, this.indexLabelsContentsEntityNameEntityId);
  }
}
