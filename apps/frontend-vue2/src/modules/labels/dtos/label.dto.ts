export class LabelDto {
  id: number;
  name?: string;
  description: string;
  accountId: number;
  createdAt: Date;
  updatedAt: Date;
  labelsContents: Array<object>;

  constructor(labelDto: LabelDto = {} as LabelDto) {
    this.id = labelDto.id;
    this.name = labelDto.name || '';
    this.description = labelDto.description;
    this.accountId = labelDto.accountId;
    this.createdAt = labelDto.createdAt;
    this.updatedAt = labelDto.updatedAt;
    this.labelsContents = labelDto.labelsContents;
  }
}
