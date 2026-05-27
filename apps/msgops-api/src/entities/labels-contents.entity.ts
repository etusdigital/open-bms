import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { LabelsEntity } from './labels.entity';
import { AutomationEntity } from './automation.entity';
import { MessageEntity } from './message.entity';

@Entity('labels_contents')
@Index('idx_labels_contents_label_id_entity_name_entity_id', ['labelId', 'entityName', 'entityId'])
export class LabelsContentsEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'label_id' })
  labelId: number;

  @Column('varchar', { name: 'entity_name' })
  entityName: string;

  @Column('int', { name: 'entity_id' })
  entityId: number;

  @ManyToOne(() => LabelsEntity, (label) => label.labelsContents, {
    eager: true,
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'label_id', referencedColumnName: 'id' })
  label: LabelsEntity;

  @ManyToOne(() => CampaignEntity, (campaign) => campaign.labelContent, {})
  @JoinColumn([{ name: 'entity_id', referencedColumnName: 'id' }])
  campaign: CampaignEntity;

  @ManyToOne(() => AutomationEntity, (automation) => automation.labelContent, {})
  @JoinColumn([{ name: 'entity_id', referencedColumnName: 'id' }])
  automation: AutomationEntity;

  @ManyToOne(() => MessageEntity, (message) => message.labelContent, {})
  @JoinColumn([{ name: 'entity_id', referencedColumnName: 'id' }])
  message: MessageEntity;
}
