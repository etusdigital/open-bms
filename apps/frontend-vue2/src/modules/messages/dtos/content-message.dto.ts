export class ContentMessageDto {
  headerType?: string;
  headerContent?: string;
  body?: string;
  footer?: string;

  constructor(contentMessageDto: ContentMessageDto = {} as ContentMessageDto) {
    this.headerType = contentMessageDto.headerType;
    this.headerContent = contentMessageDto.headerContent;
    this.body = contentMessageDto.body;
    this.footer = contentMessageDto.footer;
  }
}
