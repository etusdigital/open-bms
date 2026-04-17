import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { CampaignContactEntity } from './campaign-contact.entity';

@Entity('contacts')
export class ContactEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @OneToMany(() => CampaignContactEntity, (campaignContact: CampaignContactEntity) => campaignContact.contact, {
    nullable: true,
  })
  campaignContacts: Array<CampaignContactEntity>;
}
