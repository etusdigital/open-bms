export class Step1Data {
  name: string;
  email: string;
  password: string;
}

export class Step2Data {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export class Step3Data {
  baseUrl: string;
}

export class Step4Data {
  skip?: boolean;
  accountName?: string;
  poolName?: string;
  senderEmail?: string;
  senderName?: string;
  replyToEmail?: string;
  sendingLimit?: number;
  ips?: string[];
}

export class AdvanceStepDto {
  step: 1 | 2 | 3 | 4;
  data: Step1Data | Step2Data | Step3Data | Step4Data;
}
