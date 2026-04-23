export interface TrackerRedirectEvent {
  event: 'tracker-redirect';
  schemaVersion: 1;
  timestamp: number;
  accountId: string;
  uuid: string;
  url: string;
  ip?: string;
  userAgent?: string;
}

export interface TrackerRedirectRequest {
  platform: 'internal';
  payload: TrackerRedirectEvent[];
}
