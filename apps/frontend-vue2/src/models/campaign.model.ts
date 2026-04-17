export class CampaignModel {
  type?: string;
  name?: string;
  scheduleTo?: any;
  isActive?: boolean;
  isPublic?: boolean;
  messageId: string | number;

  constructor(
    messageId: string | number,
    type: string,
    name: string,
    scheduleTo: any,
    isActive: boolean,
    isPublic: boolean
  ) {
    // this.type = type;
    // this.name = name;
    // this.scheduleTo = scheduleTo;
    // this.isActive = isActive;
    // this.isPublic = isPublic;
    this.messageId = messageId;
  }
}
