export class MessageModel {
  type: string;
  subject: string;
  content: string;

  constructor(messageModel: MessageModel = {} as MessageModel) {
    const { type, subject, content } = messageModel;

    this.type = type;
    this.subject = subject;
    this.content = content;
  }
}
