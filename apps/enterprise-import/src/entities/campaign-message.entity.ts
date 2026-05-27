import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('campaigns_messages')
export class CampaignMessageEntity {
  @PrimaryColumn({ type: 'int', name: 'campaign_id' })
  campaignId: number;

  @PrimaryColumn({ type: 'int', name: 'message_id' })
  messageId: number;

  @Column({ type: 'json', name: 'statistics' })
  statistics: string;

  @Column({ type: 'bool', name: 'winner' })
  winner: boolean;

  @Column({ type: 'timestamp', name: 'result_date' })
  resultDate: Date;
}
