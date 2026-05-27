import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { Utils } from './utils/index.utils';
import { MessagingModule } from './messaging.module';
import { SendWhatsappConsumerService } from './send-whatsapp-consumer.service';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappChannelEntity } from './entities/whatsapp-channel.entity';
import { WhatsappChannelResolverService } from './providers/whatsapp-channel-resolver.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MessagingModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.TYPEORM_HOST,
      port: parseInt(process.env.TYPEORM_PORT || '5432'),
      username: process.env.TYPEORM_USERNAME,
      password: process.env.TYPEORM_PASSWORD,
      database: process.env.TYPEORM_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([WhatsappChannelEntity]),
    MsgopsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SendWhatsappConsumerService, Utils, WhatsappChannelResolverService],
})
export class AppModule {}
