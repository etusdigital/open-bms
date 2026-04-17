import { Entity, PrimaryColumn } from 'typeorm';

@Entity('campaigns_contacts')
export class CampaignContactEntity {
  @PrimaryColumn({ type: 'int', name: 'campaign_id' })
  campaignId: number;

  @PrimaryColumn({ type: 'int', name: 'contact_id' })
  contactId: number;
}
