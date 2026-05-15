import { Controller, Get } from '@nestjs/common';

// F20: liveness/readiness pro k8s. O worker processa jobs via BullMQ; este
// endpoint só confirma que o processo está de pé (espelha campaign-packer).
@Controller()
export class HealthController {
  @Get('/health')
  health(): { status: string; service: string } {
    return { status: 'ok', service: 'enterprise-import' };
  }
}
