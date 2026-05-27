import { Entity, Column, PrimaryColumn, DeleteDateColumn } from 'typeorm';

@Entity('labels')
export class Label {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
