import { AutomationsModule } from '../automations/automations.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TestsModule } from './../tests/tests.module';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { ContactsModule } from '../contacts/contacts.module';
import { PoolsModule } from '../pools/pools.module';
import { MessagesModule } from '../messages/messages.module';
import { ValidLinksService } from 'src/utils/utils.service';
@Module({
  imports: [HttpModule, AccountsModule, AutomationsModule, ContactsModule, HttpModule, TestsModule, PoolsModule, MessagesModule],
  providers: [ServicesService, ValidLinksService],
  controllers: [ServicesController],
})
export class ServicesModule {}
