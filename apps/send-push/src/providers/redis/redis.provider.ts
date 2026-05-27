import Redis from 'ioredis';

export const REDIS = Symbol('REDIS');

/**
 * Workers em Docker Swarm sofrem race condition na primeira conexão: o
 * container pode subir antes do DNS overlay registrar `redis`. Sem retry
 * strategy o ioredis loga "ENOTFOUND redis" em loop e o consumer AMQP
 * nunca termina de inicializar — sintoma visto em staging (campanhas 60/61
 * publicadas mas nunca enviadas).
 *
 * - retryStrategy: backoff exponencial limitado a 5s, **sempre tenta de
 *   novo** (cada attempt faz um DNS lookup novo).
 * - maxRetriesPerRequest: null — não derruba command pending quando offline.
 * - enableReadyCheck: false — não bloqueia ready event em PING falho.
 * - lazyConnect: true mantido para não atrasar o bootstrap do Nest module.
 */
export const redisProvider = {
  provide: REDIS,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      enableOfflineQueue: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
    });
  },
};
