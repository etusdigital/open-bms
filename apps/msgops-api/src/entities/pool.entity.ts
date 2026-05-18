import { BeforeUpdate, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('pools')
export class PoolEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('varchar', { name: 'pool_name', length: 255 })
  poolName: string;

  @Column('json', { name: 'ip' })
  ip: any;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }
}
