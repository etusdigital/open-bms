// EVO-1462: which provider types the new UI surfaces in the type-picker.
// Backend supports six providers; the OSS UI only exposes SendGrid until
// each new type has a verified form + e2e validation. Hidden providers
// remain reachable via the API but are absent from the add-provider modal.
// The listing still shows hidden types when they happen to be configured —
// the gate is on creation, not visibility of existing rows.

export interface EmailProviderTypeMeta {
  name: string;
  label: string;
  description: string;
  exposed: boolean;
}

export const EMAIL_PROVIDER_TYPES: EmailProviderTypeMeta[] = [
  {
    name: 'sendgrid',
    label: 'SendGrid',
    description: 'Webhook configurado automaticamente. Requer API key e domínio remetente verificado.',
    exposed: true,
  },
];

export function getProviderMeta(name: string): EmailProviderTypeMeta | undefined {
  return EMAIL_PROVIDER_TYPES.find((p) => p.name === name);
}

export function getProviderLabel(name: string): string {
  return getProviderMeta(name)?.label ?? name;
}
