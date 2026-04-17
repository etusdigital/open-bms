import { MessageDto } from './message.dto';

export class NewTestDto {
  title: string;
  triggerId: number;
  messages: MessageDto[];
  provider?: string;

  constructor(formDataMessageModel: NewTestDto = {} as NewTestDto) {
    this.title = formDataMessageModel.title;
    this.triggerId = formDataMessageModel.triggerId;
    this.messages = formDataMessageModel.messages;
    this.provider = formDataMessageModel.provider;
  }
}
