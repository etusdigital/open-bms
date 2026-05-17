import { Controller, Get } from '@nestjs/common';

// k8s liveness/readiness. Only confirms the process is up; jobs run via BullMQ.
@Controller()
export class HealthController {
  @Get('/health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'enterprise-import' };
  }
}
