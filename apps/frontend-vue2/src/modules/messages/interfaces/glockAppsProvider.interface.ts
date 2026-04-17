export interface GlockAppsProviderInterface {
  name?: string;
  inbox?: number;
  other?: number;
  spam?: number;
  missing?: number;
  finished: boolean;
  provider?: string;
}
