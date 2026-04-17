import { Entity, Column, PrimaryColumn, DeleteDateColumn } from 'typeorm';

@Entity('campaigns')
export class Campaign {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
