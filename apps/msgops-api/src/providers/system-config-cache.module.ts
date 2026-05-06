import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigEntity } from '../entities/system-config.entity';
import { SystemConfigCacheProvider } from './system-config-cache.provider';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntity])],
  providers: [SystemConfigCacheProvider],
  exports: [SystemConfigCacheProvider],
})
export class SystemConfigCacheModule {}
