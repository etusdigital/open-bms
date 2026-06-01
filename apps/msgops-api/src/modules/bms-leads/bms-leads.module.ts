import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { BmsLeadsAuthMiddleware } from './bms-leads.middleware';
import { BmsLeadsController } from './bms-leads.controller';
import { BmsTrackerController } from './bms-tracker.controller';

@Module({
  imports: [ContactsModule],
  controllers: [BmsLeadsController, BmsTrackerController],
})
export class BmsLeadsModule implements NestModule {
  // Middleware must run before PrincipalContextGuard so the api key in the BODY
  // is visible as `x-api-key` when the guard resolves the principal. Only the
  // routes that ship the key in the body need it (/bms/leads, web-push, update).
  // The tracker routes /c and /bms/cs send the key in the `api-key` HEADER, which
  // the guard reads directly — no middleware required for those.
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(BmsLeadsAuthMiddleware)
      .forRoutes(
        { path: 'bms/leads', method: RequestMethod.POST },
        { path: 'bms/leads/web-push', method: RequestMethod.POST },
        { path: 'bms/leads/update', method: RequestMethod.POST },
      );
  }
}
