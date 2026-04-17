import Redis from 'ioredis';

export const REDIS = Symbol('REDIS');

export const redisProvider = {
  provide: REDIS,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT, 10),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      enableOfflineQueue: true,
    });
  },
};
