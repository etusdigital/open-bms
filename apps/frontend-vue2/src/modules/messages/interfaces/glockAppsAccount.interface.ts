import { GlockAppsProviderInterface } from './glockAppsProvider.interface';

export interface GlockAppsAccountInterface extends GlockAppsProviderInterface {
  providers: GlockAppsProviderInterface[];
}
