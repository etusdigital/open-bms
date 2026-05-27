import { Message } from './message';

export class SingleSend {
  title: string;
  message?: Message;
  scheduledTo?: Date;
  listsIds?: Array<number>;
  segmentsIds?: Array<string>;
  id?: string;
}
