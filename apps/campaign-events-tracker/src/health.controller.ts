import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from './providers/redis/redis.service';

// Liveness probe consumed by Docker's HEALTHCHECK (see infra/swarm/stack.bms.yml).
//
// The earlier failure mode this guards against: on first boot the Swarm DNS
// overlay sometimes hadn't yet registered `redis`, so ioredis kept retrying
// silently (lazyConnect + retryStrategy never throws). The Node process stayed
// "running", Swarm saw the container as healthy, and the worker consumed zero
// AMQP messages — campaign status never advanced.
//
// With this endpoint wired into HEALTHCHECK, Docker marks the container
// unhealthy after a few failed pings and Swarm replaces it. A fresh container
// resolves `redis` correctly and the worker comes back to life.
@Controller('health')
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; redis: 'connected' }> {
    const client = this.redisService.getClient();
    try {
      // Tight timeout: the healthcheck wrapper in compose already has a 5s
      // outer cap, but the ping should be sub-100ms on a healthy network.
      const pong = await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('redis_ping_timeout')), 2_000)),
      ]);
      if (pong !== 'PONG') {
        throw new Error(`unexpected_ping_response=${pong}`);
      }
      return { status: 'ok', redis: 'connected' };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'unhealthy',
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
}
