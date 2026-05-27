import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GlockProvider } from './news.glock.provider';

@Module({
  imports: [HttpModule],
  providers: [GlockProvider],
  exports: [GlockProvider],
})
export class GlockModule {}
