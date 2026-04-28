export interface PostmasterIp {
  ip: string;
  reputation: string;
}

export interface PostmasterDate {
  date: string;
  time: number;
  domainReputation: string;
  spamRatio: number;
  spfRatio: number;
  dkimRatio: number;
  dmarcRatio: number;
  inboundRatio: number;
  spamLoops: { id: string; spamRatio: number }[] | null;
  deliveryErrors: { errorType: string; errorClass: string; errorRatio: number }[] | null;
  ips: PostmasterIp[];
}

export interface PostmasterDomain {
  domain: string;
  dates: PostmasterDate[];
}

export type ChartType = 'ip' | 'spam' | 'domain' | 'loop' | 'auth';
