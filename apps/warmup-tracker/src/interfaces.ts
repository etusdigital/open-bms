export interface Recipient {
  name: string;
  email: string;
}

export interface Message {
  id: number;
  subject: string;
  email: string;
  name: string;
}

export interface NotifyPayload {
  warmup: number;
  message: Message;
  recipients: Recipient[];
}
