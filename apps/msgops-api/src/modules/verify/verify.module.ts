import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VerifyController } from './verify.controller';
import { VerifyService } from './verify.service';
import { AccountsModule } from '../accounts/accounts.module';
import { MessagesModule } from '../messages/messages.module';
import { UtilsService } from 'src/utils/utils.service';
import { VerifyStatisticsService } from './verify-statistics.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerifyStatisticsEntity } from 'src/entities/verify-statistics.entity';

@Module({
  imports: [HttpModule, AccountsModule, MessagesModule, TypeOrmModule.forFeature([VerifyStatisticsEntity])],
  controllers: [VerifyController],
  providers: [VerifyService, UtilsService, VerifyStatisticsService],
})
export class VerifyModule {}
