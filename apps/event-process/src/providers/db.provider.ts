import 'dotenv/config';
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION, PG_CONNECTION_LOGS } from './constants';

const dbProvider = {
  provide: PG_CONNECTION,
  useValue: new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_DATABASE,
    max: parseInt(process.env.DATABASE_MAX_CONECTIONS || '40'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  }),
};

const dbProviderLogs = {
  provide: PG_CONNECTION_LOGS,
  useValue: new Pool({
    host: process.env.DATABASE_LOGS_HOST,
    port: parseInt(process.env.DATABASE_LOGS_PORT),
    user: process.env.DATABASE_LOGS_USERNAME,
    password: process.env.DATABASE_LOGS_PASSWORD,
    database: process.env.DATABASE_LOGS_DATABASE,
    max: parseInt(process.env.DATABASE_MAX_CONECTIONS || '40'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  }),
};

@Module({
  providers: [dbProvider, dbProviderLogs],
  exports: [dbProvider, dbProviderLogs],
})
export class DbProvider {}
