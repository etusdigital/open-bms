import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MsgopsService } from './msgops.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from './entities/account.entity';
import { AccountConfigEntity } from './entities/account-config.entity';
import { AccountApiKeyEntity } from './entities/account-api-key.entity';
import { ContactEntity } from './entities/contact.entity';
import { ContactCustomFieldEntity } from './entities/contact-custom-field.entity';
import { ContactTagEntity } from './entities/contact-tag.entity';
import { CustomFieldsEntity } from './entities/custom-fields.entity';
import { TagEntity } from './entities/tag.entity';
import { FormatterUtils } from '../utils/formatter.utils';
import { ContactDeviceEntity } from './entities/contact-device.entity';
import { LeadsEntity } from './entities/leads.entity';
import { SuppressionEntity } from './entities/suppression.entity';
import { ClusterMessageEntity } from './entities/cluster_message.entity';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([
      AccountEntity,
      AccountConfigEntity,
      AccountApiKeyEntity,
      ContactEntity,
      ContactCustomFieldEntity,
      ContactDeviceEntity,
      ContactTagEntity,
      CustomFieldsEntity,
      LeadsEntity,
      SuppressionEntity,
      TagEntity,
      ClusterMessageEntity,
    ]),
  ],
  exports: [MsgopsService, FormatterUtils],
  providers: [MsgopsService, FormatterUtils],
})
export class MsgopsModule {}
