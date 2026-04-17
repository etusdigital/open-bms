import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('accounts')
export class Account {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal: boolean;
}
