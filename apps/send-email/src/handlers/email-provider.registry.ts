import { EmailProviderMetadata, IEmailProvider } from './email-provider.interface';

export class EmailProviderEligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailProviderEligibilityError';
  }
}

export class EmailProviderNotFoundError extends Error {
  constructor(name: string, available: string[]) {
    super(`Email provider "${name}" is not registered. Available providers: ${available.join(', ') || '<none>'}`);
    this.name = 'EmailProviderNotFoundError';
  }
}

export class EmailProviderRegistry {
  private readonly providers = new Map<string, IEmailProvider>();

  register(provider: IEmailProvider): void {
    const metadata = provider.getMetadata();
    if (!metadata?.name) {
      throw new EmailProviderEligibilityError('Email provider rejected: getMetadata() must return a non-empty name.');
    }
    if (this.providers.has(metadata.name)) {
      throw new EmailProviderEligibilityError(`Email provider "${metadata.name}" is already registered.`);
    }
    this.providers.set(metadata.name, provider);
  }

  get(name: string): IEmailProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new EmailProviderNotFoundError(name, this.names());
    }
    return provider;
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  names(): string[] {
    return Array.from(this.providers.keys());
  }

  list(): EmailProviderMetadata[] {
    return Array.from(this.providers.values()).map((p) => p.getMetadata());
  }

  // EVO-1029 eligibility gate: every registered provider MUST expose webhook capability.
  // Boot fails if any provider violates the criterion.
  assertWebhookCapable(): void {
    const offenders = this.list().filter((m) => !m.hasWebhook);
    if (offenders.length > 0) {
      const names = offenders.map((o) => o.name).join(', ');
      throw new EmailProviderEligibilityError(`Provider(s) violate eligibility gate: hasWebhook must be true. Offenders: ${names}`);
    }
  }
}
