import { BeforeUpdate, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { AccountEntity } from './account.entity';

@Entity('emails_templates')
export class EmailsTemplatesEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('text', { name: 'html_template' })
  html_template?: string;

  @Column('text', { name: 'json_template' })
  json_template?: string;

  @Column('text', { name: 'image_template' })
  image_template?: string;

  @ManyToOne(() => AccountEntity, (account) => account.emailTemplates)
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  @Exclude()
  account: AccountEntity;

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
