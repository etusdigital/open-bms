import { Exclude, Transform } from 'class-transformer';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AccountEntity } from './account.entity';
import { ContactCustomFieldEntity } from './contact-custom-fields.entity';

@Entity('contacts')
export class ContactEntity {
  @Exclude()
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'uuid', length: 40 })
  uuid: string;

  @Exclude()
  @Column('int', { name: 'account_id' })
  accountId: number;

  @Exclude()
  @Column('varchar', { name: 'email', length: 255 })
  email: string;

  @Exclude()
  @Column('varchar', { name: 'hashed_email', length: 255 })
  hashedEmail: string;

  @Exclude()
  @Column('varchar', { name: 'first_name', length: 255 })
  firstName: string;

  @Exclude()
  @Column('varchar', { name: 'last_name', length: 255 })
  lastName: string;

  @Column('varchar', {
    name: 'email_provider',
    length: 255,
    transformer: {
      to: (value: string) => value,
      from: (value: string) => value && value[0].toLowerCase(),
    },
  })
  ep: string;

  @Column('int', { name: 'id' })
  i: number;

  @Column('varchar', { name: 'hashed_email', length: 255 })
  h: string;

  @Column('bool', { name: 'is_active' })
  a: boolean;

  @Column('bool', { name: 'is_valid' })
  vd: boolean;

  @Column('bool', { name: 'is_unsubscribed' })
  u: boolean;

  @Column('bool', { name: 'has_bounced' })
  b: boolean;

  @Column('timestamp', { name: 'last_open' })
  lo: number | string;

  @Column('timestamp', { name: 'last_click' })
  lc: number | string;

  @Column('timestamp', { name: 'last_sent' })
  ls: number;

  @Column('timestamp', { name: 'last_automation' })
  la: number;

  @Column('timestamp', { name: 'created_at' })
  cd: number;

  @ManyToOne(() => AccountEntity, (account) => account.contacts, {
    eager: false,
    nullable: true,
  })
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;

  @Transform(({ value }) => {
    return value.map((customField) => {
      return {
        id: customField.customFieldType.id,
        name: customField.customFieldType.name,
        value: customField.value,
      };
    });
  })
  @Exclude()
  @OneToMany(() => ContactCustomFieldEntity, (customFields) => customFields.contact, {
    eager: false,
    nullable: true,
  })
  customFields?: ContactCustomFieldEntity[];
}
