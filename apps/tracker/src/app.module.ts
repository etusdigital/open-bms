import { AccountMiddleware } from './middlewares/account.middleware';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { MsgopsModule } from './msgops/msgops.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerBehindProxyGuard } from './guards/throttler-behind-proxy.guard';
import { AppService } from './app.service';
import { EventPublisherService } from './event-publisher.service';
import { ClsMiddleware, ClsModule } from 'nestjs-cls';
import { FormatterUtils } from './utils/formatter.utils';
import { typeOrmConfig } from './ormconfig';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MsgopsModule,
    TypeOrmModule.forRoot(typeOrmConfig),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 1000, limit: 10 }],
      storage: new ThrottlerStorageRedisService({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
      }),
    }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false,
        setup: (cls, req) => {
          cls.set('apiKey', req.headers['api-key']);
        },
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    AppService,
    EventPublisherService,
    FormatterUtils,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware, AccountMiddleware).forRoutes('/c', '/bms/c', '/cs', '/bms/cs', '/contacts', '/bms/contacts');
  }
}
