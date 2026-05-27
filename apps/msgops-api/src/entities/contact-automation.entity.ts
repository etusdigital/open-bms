import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ContactEntity } from './contact.entity';

@Entity('contacts_automations')
export class ContactAutomationEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('int', { name: 'contact_id' })
  contactId: number;

  @Column('varchar', { name: 'status', length: 255 })
  status: string;

  @Column('int', { name: 'automation_id' })
  automationId: number;

  @Column('varchar', { name: 'automation_title', length: 255 })
  automationTitle: string;

  @Column('varchar', { name: 'automation_type', length: 100 })
  automationType: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @CreateDateColumn({ name: 'created_at_date', type: 'date' })
  createdAtDate: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => ContactEntity, (contact) => contact.contactAutomation, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'contact_id', referencedColumnName: 'id' },
    { name: 'account_id', referencedColumnName: 'accountId' },
  ])
  contact: ContactEntity;
}
