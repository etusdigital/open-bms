export interface PostmasterDateDto {
  date: Date;
  time: number;
  spamRatio: number;
  spamLoops: any;
  spfRatio: number;
  dkimRatio: number;
  dmarcRatio: number;
  inboundRatio: number;
  deliveryErrors: any;
  ips: any;
  reputation: string;
  domainReputation: string;
}

export class PostmasterDto {
  domain: string;
  dates: PostmasterDateDto[];

  constructor(postmasterDto: PostmasterDto = {} as PostmasterDto) {
    this.domain = postmasterDto.domain;
    this.dates = postmasterDto.dates;
  }
}
