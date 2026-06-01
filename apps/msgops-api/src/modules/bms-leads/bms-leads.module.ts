import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { BmsLeadsAuthMiddleware } from './bms-leads.middleware';
import { BmsLeadsController } from './bms-leads.controller';

@Module({
  imports: [ContactsModule],
  controllers: [BmsLeadsController],
})
export class BmsLeadsModule implements NestModule {
  // Middleware must run before PrincipalContextGuard so the api key in the
  // body is visible as `x-api-key` when the guard resolves the principal.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(BmsLeadsAuthMiddleware).forRoutes({ path: 'bms/leads', method: RequestMethod.POST }, { path: 'bms/leads/web-push', method: RequestMethod.POST });
  }
}
