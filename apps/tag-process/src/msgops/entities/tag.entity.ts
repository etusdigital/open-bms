import { Column, CreateDateColumn, UpdateDateColumn, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { ContactTagEntity } from './contact-tag.entity';
import { SegmentExternalQueryPayload, SegmentInfo } from '../../interfaces';

@Entity('tags')
export class TagEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('text', { name: 'description' })
  description: string;

  @Column('varchar', { name: 'type', length: 255 })
  type: string;

  @Column('int', { name: 'recurrence' })
  recurrence: number;

  @Column('varchar', { name: 'schedule_cloud_task_id', length: 255 })
  scheduleCloudTaskId: string;

  @Column('text', { name: 'query' })
  query: string;

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

  @Column('varchar', { name: 'status', length: 20 })
  status: string;

  @Column('boolean', { name: 'is_real_time_segment' })
  isRealTimeSegment: boolean;

  @Column('json', { name: 'external_query_steps' })
  externalQuerySteps: Array<SegmentExternalQueryPayload> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ContactTagEntity, (contactTag) => contactTag.tag, {
    eager: false,
    nullable: true,
    onDelete: 'CASCADE',
  })
  contactTag?: Array<ContactTagEntity>;
}
