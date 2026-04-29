import { Column, CreateDateColumn, UpdateDateColumn, Entity, PrimaryGeneratedColumn, OneToMany, BeforeInsert, BeforeUpdate, Unique } from 'typeorm';
import { ContactTagEntity } from './contact-tag.entity';

export interface SegmentInfo {
  date: Date;
  status: boolean;
  duration: number;
  count: number;
}

@Entity('tags')
@Unique(['accountId', 'name'])
export class TagEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('varchar', { name: 'type', length: 255 })
  type: string;

  @Column('int', { name: 'recurrence' })
  recurrence: number;

  @Column('varchar', { name: 'schedule_cloud_task_id', length: 255 })
  scheduleCloudTaskId: string;

  @Column('json', { name: 'steps' })
  steps: string;

  @Column('json', { name: 'segment_info' })
  segmentInfo: SegmentInfo[];

  @Column('int', { name: 'contacts_limit' })
  contactsLimit: number;

  @Column('int', { name: 'last_count' })
  lastCount: number;

  @Column('int', { name: 'last_count_email' })
  lastCountEmail: number;

  @Column('int', { name: 'last_count_web_push' })
  lastCountWebPush: number;

  @Column('int', { name: 'last_count_mobile_push' })
  lastCountMobilePush: number;

  @Column('int', { name: 'last_count_phone' })
  lastCountPhone: number;

  @Column('int', { name: 'last_count_whatsapp' })
  lastCountWhatsapp: number;

  @Column('boolean', { name: 'add_bounced' })
  addBounced: boolean;

  @Column('boolean', { name: 'add_unsubscribed' })
  addUnsubscribed: boolean;

  @Column('boolean', { name: 'add_invalid' })
  addInvalid: boolean;

  @Column('boolean', { name: 'is_real_time_segment' })
  isRealTimeSegment: boolean;

  @Column('varchar', { name: 'status', length: 20 })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  isProcessing?: boolean;

  @OneToMany(() => ContactTagEntity, (contactTag) => contactTag.tag, {
    eager: false,
    nullable: true,
    onDelete: 'CASCADE',
  })
  contactTag?: Array<ContactTagEntity>;

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }

  @BeforeInsert()
  addName() {
    this.name = this.name.trim().toLowerCase();
  }
}
