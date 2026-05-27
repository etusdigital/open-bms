import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { replaceSpecialChars } from '../utils/utils.service';
import { AccountEntity } from './account.entity';

@Entity('custom_fields')
@Unique(['accountId', 'name'])
export class CustomFieldsEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'title', length: 40 })
  title: string;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('int', { name: 'order' })
  order: number;

  @Column('varchar', { name: 'type', length: 50 })
  type: string;

  @Column('varchar', { name: 'attribution_type', length: 20 })
  attributionType: string;

  @Column('varchar', { name: 'label', length: 255 })
  label: string;

  @Column('varchar', { name: 'placeholder', length: 255 })
  placeholder: string;

  @Column('varchar', { name: 'field_type', length: 20 })
  fieldType: string;

  @Column('varchar', { name: 'field_format', length: 255 })
  fieldFormat: string;

  @Column('text', { name: 'file_formats' })
  fileFormats: string[];

  @Column('int', { name: 'character_limit' })
  characterLimit: number;

  @Column('int', { name: 'decimal_length' })
  decimalLength: number;

  @Column('text', { name: 'options' })
  options: string[];

  @Column('varchar', { name: 'mask', length: 255 })
  mask: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => AccountEntity, (account) => account.customFields)
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;

  @BeforeInsert()
  @BeforeUpdate()
  formattedFields() {
    this.title = this.title.trim();
    this.name = replaceSpecialChars(this.title).toUpperCase();
  }

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }
}
