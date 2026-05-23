import 'dotenv/config';
import { Logger, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION, PG_CONNECTION_LOGS } from './constants';

const env = process.env;
const logger = new Logger('DbProvider');

// OSS runs a single Postgres, so DATABASE_LOGS_* falls back to the main
// TYPEORM_* connection. Split-DB deployments must set DATABASE_LOGS_*
// explicitly or log writes will land on the main database.
const mainHost = env.DATABASE_HOST ?? env.TYPEORM_HOST;
const mainPort = env.DATABASE_PORT ?? env.TYPEORM_PORT ?? '5432';
const mainUser = env.DATABASE_USERNAME ?? env.TYPEORM_USERNAME;
const mainDb = env.DATABASE_DATABASE ?? env.TYPEORM_DATABASE;

const logsHost = env.DATABASE_LOGS_HOST ?? env.TYPEORM_HOST;
const logsPort = env.DATABASE_LOGS_PORT ?? env.TYPEORM_PORT ?? '5432';
const logsDb = env.DATABASE_LOGS_DATABASE ?? env.TYPEORM_DATABASE;

logger.log(
  `main pg=${mainUser}@${mainHost}:${mainPort}/${mainDb} (DATABASE_HOST set=${!!env.DATABASE_HOST}); logs pg=${logsHost}:${logsPort}/${logsDb} (DATABASE_LOGS_HOST set=${!!env.DATABASE_LOGS_HOST})`,
);

const dbProvider = {
  provide: PG_CONNECTION,
  useValue: new Pool({
    host: mainHost,
    port: parseInt(mainPort, 10),
    user: mainUser,
    password: env.DATABASE_PASSWORD ?? env.TYPEORM_PASSWORD,
    database: mainDb,
    max: parseInt(env.DATABASE_MAX_CONECTIONS || '40', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  }),
};

const dbProviderLogs = {
  provide: PG_CONNECTION_LOGS,
  useValue: new Pool({
    host: logsHost,
    port: parseInt(logsPort, 10),
    user: env.DATABASE_LOGS_USERNAME ?? env.TYPEORM_USERNAME,
    password: env.DATABASE_LOGS_PASSWORD ?? env.TYPEORM_PASSWORD,
    database: logsDb,
    max: parseInt(env.DATABASE_MAX_CONECTIONS || '40', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  }),
};

@Module({
  providers: [dbProvider, dbProviderLogs],
  exports: [dbProvider, dbProviderLogs],
})
export class DbProvider {}
