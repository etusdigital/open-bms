import { Global, Module } from '@nestjs/common';
import { HtmlToTextService } from './html-to-text.service';

@Global()
@Module({
  providers: [HtmlToTextService],
  exports: [HtmlToTextService],
})
export class HtmlToTextModule {}
