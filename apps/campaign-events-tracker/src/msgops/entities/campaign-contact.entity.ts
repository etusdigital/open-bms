import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { CampaignEntity } from './campaign.entity';
import { ContactEntity } from './contact.entity';

@Entity('campaigns_contacts')
export class CampaignContactEntity {
  @PrimaryColumn({ type: 'int', name: 'campaign_id' })
  campaignId: number;

  @PrimaryColumn({ type: 'int', name: 'contact_id' })
  contactId: number;

  @ManyToOne(() => ContactEntity, (contact: ContactEntity) => contact.campaignContacts)
  @JoinColumn([{ name: 'contact_id', referencedColumnName: 'id' }])
  contact: ContactEntity;

  @ManyToOne(() => CampaignEntity, (campaign: CampaignEntity) => campaign.campaignContacts)
  @JoinColumn([{ name: 'campaign_id', referencedColumnName: 'id' }])
  campaign: CampaignEntity;
}
