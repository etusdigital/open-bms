import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { MsgopsModule } from './msgops/msgops.module';
import { LeadPublisherService } from './providers/lead-publisher.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './ormconfig';
import { Utils } from './utils';

@Module({
  imports: [ConfigModule.forRoot(), MsgopsModule, TypeOrmModule.forRoot(typeOrmConfig)],
  controllers: [AppController],
  providers: [AppService, LeadPublisherService, Utils],
})
export class AppModule {}
