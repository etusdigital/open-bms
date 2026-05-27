import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ContactEntity } from './contact.entity';
import { CustomFieldsEntity } from './custom-fields.entity';
import { AccountConfigEntity } from './account-config.entity';

@Entity('accounts')
export class AccountEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => ContactEntity, (contact) => contact.account)
  contacts?: ContactEntity[];

  @OneToMany(() => CustomFieldsEntity, (customFields) => customFields.account, {
    eager: true,
    nullable: true,
  })
  customFields?: CustomFieldsEntity[];

  @OneToMany(() => AccountConfigEntity, (accountConfigs) => accountConfigs.account, {
    eager: false,
    nullable: true,
  })
  accountConfigs?: AccountConfigEntity[];
}
