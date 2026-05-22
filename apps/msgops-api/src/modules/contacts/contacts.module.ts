import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { ContactEntity } from '../../entities/contact.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormatterUtils } from '../../utils/pubSub/formatter.utils';
import { CustomFieldsEntity } from '../../entities/custom-fields.entity';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { UtilsService } from '../../utils/utils.service';
import { ContactCustomFieldEntity } from '../../entities/contact-custom-field.entity';
import { ContactTagEntity } from 'src/entities/contact-tag.entity';
import { ContactDeviceEntity } from 'src/entities/contact-device.entity';
import { CustomEventModule } from '../custom-events/custom-events.module';
import { SuppressionEntity } from 'src/entities/suppression.entity';
import { AccountEntity } from 'src/entities/account.entity';
import { ContactAutomationEntity } from 'src/entities/contact-automation.entity';
import { AuditEntity } from 'src/entities/audit.entity';
import { AuditService } from 'src/utils/audits/audit.service';
import { ClickhouseProvider } from '../../providers/clickhouse.provider';

@Module({
  imports: [
    AccountsModule,
    CustomEventModule,
    TypeOrmModule.forFeature([
      ContactEntity,
      SuppressionEntity,
      AccountEntity,
      ContactTagEntity,
      CustomFieldsEntity,
      ContactCustomFieldEntity,
      ContactDeviceEntity,
      ContactAutomationEntity,
      AuditEntity,
    ]),
  ],
  providers: [ContactsService, FormatterUtils, CustomFieldsService, UtilsService, AuditService, ClickhouseProvider],
  exports: [ContactsService],
  controllers: [ContactsController],
})
export class ContactsModule {}
