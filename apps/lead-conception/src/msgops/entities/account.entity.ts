import { AfterLoad, Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AccountConfigEntity } from './account-config.entity';
import { CustomFieldsEntity } from './custom-fields.entity';

@Entity('accounts')
export class AccountEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description: string;

  @Column('boolean', { name: 'is_internal', default: false })
  isInternal: boolean;

  @Column('integer', { name: 'group_id' })
  groupId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @OneToMany(() => AccountConfigEntity, (accountConfigs) => accountConfigs.account, {
    eager: true,
    nullable: true,
  })
  accountConfigs?: AccountConfigEntity[];

  @OneToMany(() => CustomFieldsEntity, (customFields) => customFields.account, {
    eager: true,
    nullable: true,
  })
  customFields?: CustomFieldsEntity[];

  customFieldsKeys: Array<string>;

  @AfterLoad()
  parseCustomFields() {
    if (!this.customFields) {
      return;
    }
    this.customFieldsKeys = this.customFields.map((customField) => {
      return customField.name.toLocaleLowerCase();
    });
  }
}
