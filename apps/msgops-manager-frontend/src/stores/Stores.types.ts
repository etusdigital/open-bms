export enum Storekeys {
  ACCOUNTS = 'accounts',
  USERS = 'users',
  BILLING = 'billing',
}

export type StorekeysValues = keyof typeof Storekeys;
