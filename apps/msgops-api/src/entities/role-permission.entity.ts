import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RoleEntity } from './role.entity';

@Entity('role_permissions')
export class RolePermissionEntity {
  @PrimaryColumn({ type: 'int', name: 'role_id' })
  roleId: number;

  @PrimaryColumn({ type: 'varchar', name: 'permission_key', length: 160 })
  permissionKey: string;

  @Column('varchar', { name: 'effect', length: 20, default: 'allow' })
  effect: string;

  @ManyToOne(() => RoleEntity, (role) => role.permissions, { onDelete: 'CASCADE' })
  @JoinColumn([{ name: 'role_id', referencedColumnName: 'id' }])
  role: RoleEntity;
}
