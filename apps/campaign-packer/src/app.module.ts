import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CampaignModule } from './campaign/campaign.module';
import { FormatterUtils } from './utils/formatter.utils';
import { MsgopsModule } from './msgops/msgops.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [CampaignModule, MsgopsModule, ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  controllers: [AppController],
  providers: [AppService, FormatterUtils],
})
export class AppModule {}
