export class TemplateDto {
  id?: number;
  name: string;
  description: string;
  html_template?: any;
  json_template?: any;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;

  constructor(templateDto: TemplateDto = {} as TemplateDto) {
    this.id = templateDto.id;
    this.name = templateDto.name;
    this.description = templateDto.description;
    this.html_template = templateDto.html_template;
    this.json_template = templateDto.json_template;
    this.createdAt = templateDto.createdAt;
    this.updatedAt = templateDto.updatedAt;
    this.deletedAt = templateDto.deletedAt;
  }
}
