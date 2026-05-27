import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { RolePermissionEntity } from './role-permission.entity';

@Entity('roles')
@Unique(['code'])
export class RoleEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'code', length: 80 })
  code: string;

  @Column('varchar', { name: 'name', length: 120 })
  name: string;

  @Column('text', { name: 'description', nullable: true })
  description?: string;

  @Column('boolean', { name: 'is_system', default: true })
  isSystem: boolean;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => RolePermissionEntity, (permission) => permission.role, {
    nullable: true,
  })
  permissions?: RolePermissionEntity[];
}
