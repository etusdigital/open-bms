export class CustomFieldsDto {
  id: number;
  accountId: number;
  title: string;
  name: string;
  description: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  type?: string | null;
  label?: string | null;
  placeholder?: string | null;
  fieldFormat?: string | null;
  fileFormats?: string[] | null;
  characterLimit?: number | null;
  decimalLength?: number | null;
  options?: string[] | null;
  mask?: string | null;
  attributionType?: string | null;
  fieldType?: string | null;

  constructor(customFieldDto: CustomFieldsDto = {} as CustomFieldsDto) {
    this.id = customFieldDto.id;
    this.accountId = customFieldDto.accountId;
    this.title = customFieldDto.title;
    this.name = customFieldDto.name;
    this.description = customFieldDto.description;
    this.order = customFieldDto.order;
    this.createdAt = customFieldDto.createdAt;
    this.updatedAt = customFieldDto.updatedAt;
    this.type = customFieldDto.type;
    this.label = customFieldDto.label;
    this.placeholder = customFieldDto.placeholder;
    this.fieldFormat = customFieldDto.fieldFormat;
    this.fileFormats = customFieldDto.fileFormats;
    this.characterLimit = customFieldDto.characterLimit;
    this.decimalLength = customFieldDto.decimalLength;
    this.options = customFieldDto.options;
    this.mask = customFieldDto.mask;
    this.attributionType = customFieldDto.attributionType;
    this.fieldType = customFieldDto.fieldType;
  }
}
