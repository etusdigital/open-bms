import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('campaigns')
@Unique(['accountId', 'name'])
export class CampaignEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'title', length: 255 })
  title: string;

  @Column('text', { name: 'description' })
  description?: string;

  @Column('varchar', { name: 'name', length: 40 })
  name: string;

  @Column('varchar', { name: 'publisher', length: 100 })
  publisher: string;

  @Column('timestamptz', { name: 'schedule_to' })
  scheduleTo: Date;

  @Column('varchar', { name: 'schedule_to_cloud_task_id', length: 255 })
  scheduleToCloudTaskId: string;

  @Column('int', { name: 'status' })
  status: number;

  @Column('int', { name: 'spread_sending' })
  spreadSending: number;

  @Column('decimal', { name: 'sent_contacts' })
  sentContacts: number;

  @Column('decimal', { name: 'sent_percentage' })
  sentPercentage: number;

  @Column('text', { name: 'query', select: false })
  query: string;

  @Column('json', { name: 'steps' })
  steps: any;

  @Column('json', { name: 'tags' })
  tags: object[];

  @Column('varchar', { name: 'type', length: 30 })
  type: string;

  @Column('varchar', { name: 'message_type', length: 30, default: 'email' })
  messageType: string;

  @Column('boolean', { name: 'send_to_all', default: false })
  sendToAll: boolean;

  @Column('timestamptz', { name: 'testab_schedule_to' })
  testabScheduleTo: Date;

  @Column('timestamptz', { name: 'testab_schedule_end' })
  testabScheduleEnd: Date;

  @Column('int', { name: 'testab_audience_percent' })
  testabAudiencePercent: number;

  @Column('varchar', { name: 'testab_criteria', length: 255 })
  testabCriteria: string;

  @Column('boolean', { name: 'testab_sent_after_test', default: false })
  testabSentAfterTest: boolean;

  @Column('int', { name: 'testab_last_id' })
  testabLastId: number;

  @Column('varchar', { name: 'testab_schedule_to_cloud_task_id', length: 255 })
  testabScheduleToCloudTaskId: string;

  @Column('varchar', { name: 'testab_schedule_end_cloud_task_id', length: 255 })
  testabScheduleEndCloudTaskId: string;

  @Column('int', { name: 'recurrence_count' })
  recurrenceCount: number;

  @Column('json', { name: 'recurrence_settings' })
  recurrenceSettings: Record<string, any>;

  @Column('bool', { name: 'is_rate_limit' })
  isRateLimit: boolean;

  @Column('bool', { name: 'is_run_segment' })
  runSegment: boolean;

  @Column('json', { name: 'triggers' })
  triggers: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
