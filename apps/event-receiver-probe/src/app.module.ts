import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EchoController } from './echo.controller';
import { ProbeConsumerService } from './probe-consumer.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [EchoController],
  providers: [ProbeConsumerService],
})
export class AppModule {}
