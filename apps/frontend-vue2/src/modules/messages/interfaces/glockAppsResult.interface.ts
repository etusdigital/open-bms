import { GlockAppsAccountInterface } from './glockAppsAccount.interface';

export interface GlockAppsResultInterface extends GlockAppsAccountInterface {
  // accounts: GlockAppsAccountInterface[];
  senders: GlockAppsAccountInterface[];
}
