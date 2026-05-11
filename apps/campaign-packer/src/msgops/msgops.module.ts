import { Module } from '@nestjs/common';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity } from './entities/campaign.entity';
import { ContactEntity } from './entities/contact.entity';
import { CampaignContactEntity } from './entities/campaign-contact.entity';
import { ContactCustomFieldEntity } from './entities/contact-custom-field.entity';
import { CustomFieldsEntity } from './entities/custom-fields.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { CampaignMessageEntity } from './entities/campaign-message.entity';
import { AccountEntity } from './entities/account.entity';
import { MessageEntity } from './entities/message.entity';
import { TagProcessProvider } from 'src/providers/tag-process.provider';
import { HttpModule } from '@nestjs/axios';
import { typeOrmConfig } from '../ormconfig';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forRoot(typeOrmConfig),
    TypeOrmModule.forFeature([
      AccountConfigEntity,
      CampaignEntity,
      CampaignContactEntity,
      CampaignMessageEntity,
      ContactEntity,
      ContactCustomFieldEntity,
      CustomFieldsEntity,
      AccountEntity,
      MessageEntity,
    ]),
  ],
  exports: [MsgopsService],
  providers: [MsgopsService, TagProcessProvider],
})
export class MsgopsModule {}
