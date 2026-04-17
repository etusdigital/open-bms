export interface WriteEmailInterface {
  $refs: any;
}

export interface MessageInterface {
  titleMessage: string;
  replyTo: string;
  subject: string;
  previewText?: string;
  priority?: string;
  ippool?: string;
  content: string;
  content_json?: string;
  text: string;
  campaignId: number;
  messageId?: number;
  version: number;
  fromMail: string;
  fromName: string;
  id: number;
  isTested?: boolean;
  createdAt: Date;
  deletedAt?: Date;
  updatedAt?: Date;
}
