export class PostmasterFiltersDto {
  startDate?: Date | undefined;
  endDate?: Date | undefined;

  constructor(postmasterFiltersDto: PostmasterFiltersDto = {} as PostmasterFiltersDto) {
    this.startDate = postmasterFiltersDto.startDate;
    this.endDate = postmasterFiltersDto.endDate;
  }
}
