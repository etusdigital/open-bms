export class FileUploadDto {
  name: string;
  data: string;
  userId: number;
  pathExternal?: string;

  constructor(fileUpload: FileUploadDto = {} as FileUploadDto) {
    this.name = fileUpload.name;
    this.data = fileUpload.data;
    this.userId = fileUpload.userId;
    this.pathExternal = fileUpload.pathExternal;
  }
}
