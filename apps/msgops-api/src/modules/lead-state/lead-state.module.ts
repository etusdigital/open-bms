import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LeadStateProvider } from './lead-state.providers';
import { LeadStateService } from './lead-state.service';
import { LeadStateController } from './lead-state.controller';

@Module({
  imports: [HttpModule],
  providers: [LeadStateService, LeadStateProvider],
  controllers: [LeadStateController],
})
export class LeadStateModule {}
