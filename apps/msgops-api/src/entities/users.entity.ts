import { BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { RoleEntity } from './role.entity';
import { UserAccountEntity } from './users-account.entity';

@Entity('users')
@Index('idx_users_provider_id', ['providerId'])
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('varchar', { name: 'email', length: 255 })
  email: string;

  @Column('varchar', { name: 'profile', length: 500 })
  profile: string;

  @Column('varchar', { name: 'provider_id', length: 500 })
  providerId: string;

  @Column('json', { name: 'settings' })
  settings: Record<string, string>;

  @Column('int', { name: 'global_role_id', nullable: true })
  globalRoleId?: number;

  @Column('varchar', { name: 'status', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => UserAccountEntity, (userAccount) => userAccount.user, {
    eager: true,
    nullable: true,
  })
  userAccount: Array<UserAccountEntity>;

  @ManyToOne(() => RoleEntity, { eager: true, nullable: true })
  @JoinColumn([{ name: 'global_role_id', referencedColumnName: 'id' }])
  globalRole?: RoleEntity;

  @BeforeInsert()
  setuserLanguage() {
    this.settings = this.settings || { language: 'pt-BR' };
    this.email = this.email.toLowerCase();
  }
}
