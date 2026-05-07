import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MailModule } from '../mail/mail.module';
import { SendGridHandler } from './sendgrid/sendGrid.handler';
import { SparkPostHandler } from './sparkpost/sparkPost.handler';
import { MailerSendHandler } from './mailersend/mailerSend.handler';
import { ResendHandler } from './resend/resend.handler';
import { EmailProviderRegistry } from './email-provider.registry';
import { EmailProviderRouter } from './email-provider.router';
import { EMAIL_PROVIDER_REGISTRY_TOKEN } from './email-provider.tokens';

@Module({
  imports: [MailModule],
  providers: [
    MailerSendHandler,
    ResendHandler,
    {
      provide: EMAIL_PROVIDER_REGISTRY_TOKEN,
      useFactory: (sparkpost: SparkPostHandler, sendgrid: SendGridHandler, mailersend: MailerSendHandler, resend: ResendHandler) => {
        const registry = new EmailProviderRegistry();
        registry.register(sparkpost);
        registry.register(sendgrid);
        registry.register(mailersend);
        registry.register(resend);
        return registry;
      },
      inject: [SparkPostHandler, SendGridHandler, MailerSendHandler, ResendHandler],
    },
    EmailProviderRouter,
  ],
  exports: [EMAIL_PROVIDER_REGISTRY_TOKEN, EmailProviderRouter, MailerSendHandler, ResendHandler],
})
export class EmailProvidersModule implements OnModuleInit {
  private readonly logger = new Logger(EmailProvidersModule.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    const registry = this.moduleRef.get<EmailProviderRegistry>(EMAIL_PROVIDER_REGISTRY_TOKEN, {
      strict: false,
    });
    registry.assertWebhookCapable();
    const summary = registry
      .list()
      .map((m) => `${m.name}(free=${m.hasFreeTier},webhook=${m.hasWebhook})`)
      .join(', ');
    this.logger.log(`EmailProviderRegistry: ${registry.names().length} providers registered — ${summary}`);
  }
}
