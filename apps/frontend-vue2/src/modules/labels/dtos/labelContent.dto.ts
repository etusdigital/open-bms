import { LabelDto } from "./label.dto";

export class LabelContentDto {
  id: number;
  labelId: number;
  entityName: string;
  entityId: number;
  label: LabelDto;

  constructor(labelContentDto: LabelContentDto = {} as LabelContentDto) {
    this.id = labelContentDto.id;
    this.labelId = labelContentDto.labelId;
    this.entityName = labelContentDto.entityName;
    this.entityId = labelContentDto.entityId;
    this.label = labelContentDto.label;
  }
}
