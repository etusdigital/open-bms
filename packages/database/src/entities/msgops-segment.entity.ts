import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('tags')
export class MsgopsSegment {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'varchar', length: 40 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  type: string;
}
