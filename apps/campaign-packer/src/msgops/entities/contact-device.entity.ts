import { DeviceType } from '../../interfaces';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ContactEntity } from './contact.entity';

@Entity('contacts_devices')
export class ContactDeviceEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('int', { name: 'contact_id' })
  contactId: number;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @Column('varchar', { name: 'type', length: 40, default: DeviceType.EMAIL })
  type: DeviceType;

  @Column('varchar', { name: 'token', length: 255 })
  token: string;

  @Column('bool', { name: 'is_unsubscribed', default: false })
  isUnsubscribed: boolean;

  @Column('varchar', { name: 'ip', length: 50 })
  ip: string;

  @Column('varchar', { name: 'device_type', length: 60 })
  deviceType: string;

  @Column('varchar', { name: 'os', length: 60 })
  os: string;

  @Column('varchar', { name: 'browser', length: 50 })
  browser: string;

  @Column('varchar', { name: 'browser_version', length: 50 })
  browserVersion: string;

  @Column('varchar', { name: 'resolution', length: 50 })
  resolution: string;

  @Column('varchar', { name: 'subscription_url', length: 400 })
  subscriptionUrl: string;

  @Column('varchar', { name: 'latest_visited_url', length: 400 })
  latestVisitedUrl: string;

  @Column({ name: 'last_session', type: 'timestamptz' })
  lastSession: Date;

  @Column({ name: 'last_sent', type: 'timestamptz' })
  lastSent: Date;

  @Column({ name: 'last_sent_date', type: 'date' })
  lastSentDate: Date;

  @Column({ name: 'last_view', type: 'timestamptz' })
  lastView: Date;

  @Column({ name: 'last_view_date', type: 'date' })
  lastViewDate: Date;

  @Column({ name: 'last_click', type: 'timestamptz' })
  lastClick: Date;

  @Column({ name: 'last_click_date', type: 'date' })
  lastClickDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => ContactEntity, (contact) => contact.contactDevices)
  @JoinColumn([
    { name: 'contact_id', referencedColumnName: 'id' },
    { name: 'account_id', referencedColumnName: 'accountId' },
  ])
  contact: ContactEntity;
}
