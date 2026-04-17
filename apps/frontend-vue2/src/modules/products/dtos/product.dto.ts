export class ProductDto {
  id?: number;
  date: string;
  hour: string;
  status: string;

  constructor(productDto: ProductDto = {} as ProductDto) {
    this.id = productDto.id;
    this.status = productDto.status;
    this.hour = productDto.hour;
    this.date = productDto.date;
  }
}
