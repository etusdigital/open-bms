import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import 'dotenv/config';

const config: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.TYPEORM_HOST,
  port: parseInt(process.env.TYPEORM_PORT),
  username: process.env.TYPEORM_USERNAME,
  password: process.env.TYPEORM_PASSWORD,
  database: process.env.TYPEORM_DATABASE,
  extra: process.env.TYPEORM_DRIVER_EXTRA,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/**/migrations/*.js'],
  migrationsTableName: process.env.TYPEORM_MIGRATIONS_TABLE_NAME,
  migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
  dropSchema: process.env.TYPEORM_DROP_SCHEMA === 'true',
  logging: process.env.TYPEORM_LOGGING === 'true',
};

export const typeOrmConfig = config;
