import { MessageDto } from '../../messages/dtos/message.dto';

export class AutomationPatchDto {
  id?: number;
  title?: string;
  type?: string;
  message?: MessageDto;
  audienceIdExternal?: number;
  audienceName?: string;
  isActive?: boolean;

  constructor(automationPatchDto: AutomationPatchDto = {} as AutomationPatchDto) {
    this.id = automationPatchDto.id;
    this.title = automationPatchDto.title;
    this.type = automationPatchDto.type;
    this.isActive = automationPatchDto.isActive;
    this.message = automationPatchDto.message;
    this.audienceName = automationPatchDto.audienceName;
    this.audienceIdExternal = automationPatchDto.audienceIdExternal;
  }
}
