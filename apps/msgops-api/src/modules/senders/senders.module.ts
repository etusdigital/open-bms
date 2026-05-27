import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountConfigEntity } from '../../entities/account-config.entity';
import { SenderEntity } from '../../entities/sender.entity';
import { SendersService } from './senders.service';
import { SendersController } from './senders.controller';
import { SendgridHandler } from './../../handlers/email/sendgrid/sendgrid.handler';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([AccountConfigEntity, SenderEntity])],
  controllers: [SendersController],
  providers: [AccountConfigsProvider, SendersService, SendgridHandler],
  exports: [SendersService],
})
export class SendersModule {}
