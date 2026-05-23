import 'dotenv/config';
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION, PG_CONNECTION_LOGS } from './constants';

const env = process.env;

const dbProvider = {
  provide: PG_CONNECTION,
  useValue: new Pool({
    host: env.DATABASE_HOST ?? env.TYPEORM_HOST,
    port: parseInt(env.DATABASE_PORT ?? env.TYPEORM_PORT),
    user: env.DATABASE_USERNAME ?? env.TYPEORM_USERNAME,
    password: env.DATABASE_PASSWORD ?? env.TYPEORM_PASSWORD,
    database: env.DATABASE_DATABASE ?? env.TYPEORM_DATABASE,
    max: parseInt(env.DATABASE_MAX_CONECTIONS || '40'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  }),
};

const dbProviderLogs = {
  provide: PG_CONNECTION_LOGS,
  useValue: new Pool({
    host: env.DATABASE_LOGS_HOST ?? env.TYPEORM_HOST,
    port: parseInt(env.DATABASE_LOGS_PORT ?? env.TYPEORM_PORT),
    user: env.DATABASE_LOGS_USERNAME ?? env.TYPEORM_USERNAME,
    password: env.DATABASE_LOGS_PASSWORD ?? env.TYPEORM_PASSWORD,
    database: env.DATABASE_LOGS_DATABASE ?? env.TYPEORM_DATABASE,
    max: parseInt(env.DATABASE_MAX_CONECTIONS || '40'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  }),
};

@Module({
  providers: [dbProvider, dbProviderLogs],
  exports: [dbProvider, dbProviderLogs],
})
export class DbProvider {}
