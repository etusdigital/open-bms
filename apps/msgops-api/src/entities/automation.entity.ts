import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AccountEntity } from './account.entity';
import { replaceSpecialChars } from '../utils/utils.service';
import { LabelsContentsEntity } from './labels-contents.entity';

@Entity('automations')
@Unique(['accountId', 'name'])
export class AutomationEntity {
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

  @Column('bool', { name: 'active' })
  isActive: boolean;

  @Column('varchar', { name: 'type', length: 50 })
  type: string;

  @Column('jsonb', { name: 'steps' })
  steps: any;

  @Column('jsonb', { name: 'triggers' })
  triggers: any;

  @Column('int', { name: 'step_id' })
  stepId: number;

  @Column('int', { name: 'count_steps' })
  countSteps: number;

  @Column('bool', { name: 'is_rate_limit' })
  isRateLimit: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;

  @Column('varchar', { name: 'version', length: 20, default: Date.now().toString() })
  version?: string;

  @Column('varchar', { name: 'vertical_type', length: 255, nullable: true })
  verticalType?: string;

  @Column('varchar', { name: 'target', length: 255, nullable: true })
  target?: string;

  @Column('jsonb', { name: 'flow_layout', nullable: true })
  flowLayout?: Record<string, unknown>;

  @ManyToOne(() => AccountEntity, (account) => account.automations, {
    eager: true,
    nullable: false,
  })
  @JoinColumn([{ name: 'account_id', referencedColumnName: 'id' }])
  account: AccountEntity;

  @OneToMany(() => LabelsContentsEntity, (labelContent) => labelContent.automation, {
    eager: false,
    nullable: true,
  })
  labelContent: Array<LabelsContentsEntity>;

  @BeforeInsert()
  @BeforeUpdate()
  addName() {
    this.title = this.title.trim();
    this.name = replaceSpecialChars(this.title);
  }

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }
}
