export class TagsSearchDto {
  title?: string;
  type?: string;
  page: number;
  itemsPerPage: number;

  constructor(tagsSearchDto: TagsSearchDto = {} as TagsSearchDto) {
    this.title = tagsSearchDto.title;
    this.type = tagsSearchDto.type;
    this.page = tagsSearchDto.page;
    this.itemsPerPage = tagsSearchDto.itemsPerPage;
  }
}
