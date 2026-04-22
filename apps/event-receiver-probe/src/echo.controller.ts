import { Controller, Post, Req, Res } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Controller()
export class EchoController {
  @Post('/internal/event/received')
  async handle(@Req() req: FastifyRequest, @Res({ passthrough: false }) res: FastifyReply) {
    const token = req.headers['x-internal-token'];
    if (token !== process.env.INTERNAL_AUTH_TOKEN) {
      return res.status(401).send({ error: 'unauthorized' });
    }

    // PROBE_ALWAYS_ERROR drives DLQ validation; per-request header overrides for ad-hoc cases.
    const forced = req.headers['x-probe-force-error'] ?? process.env.PROBE_ALWAYS_ERROR;
    if (forced) {
      const status = Number(forced);
      if (Number.isFinite(status) && status >= 400 && status < 600) {
        console.log(`[probe] forcing status=${status} attempt=${req.headers['x-bms-attempt']}`);
        return res.status(status).send({ forced: true });
      }
    }

    console.log(
      `[probe] received attempt=${req.headers['x-bms-attempt']} routingKey=${req.headers['x-bms-routing-key']}`,
    );
    return res.status(200).send({ received: true });
  }
}
