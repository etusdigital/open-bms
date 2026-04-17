import { Body, Controller, Post } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { BucketsService } from './buckets.service';
import { FileResponseDto } from './file-response.dto';
import { FileUploadDto } from './file-upload.dto';
import { ImageUrlDto } from './image-url.dto';
import { RequirePermission } from '../authz/require-permission.decorator';

@Controller('buckets')
@ApiBearerAuth()
@ApiTags('External')
export class BucketsController {
  constructor(
    private readonly bucketsService: BucketsService,
    private readonly httpService: HttpService,
  ) {}

  @Post()
  @ApiBody({ type: [FileUploadDto] })
  @RequirePermission('messages:create')
  async uploadFilesToGCS(@Body() filesUpload: Array<FileUploadDto>): Promise<Array<FileResponseDto>> {
    const files = await this.bucketsService.uploadFilesToGCS(filesUpload);
    return files;
  }

  @Post('base64')
  @ApiBody({ type: ImageUrlDto })
  @RequirePermission('messages:create')
  async getImageBase64(@Body() imageUrlDto: ImageUrlDto): Promise<string> {
    const response = await this.httpService
      .get(imageUrlDto.url, {
        responseType: 'arraybuffer',
      })
      .toPromise();

    return `data:${response.headers['content-type'].toLowerCase()};base64,${Buffer.from(response.data, 'binary').toString('base64')}`;
  }

  @Post('generic-upload')
  @RequirePermission('messages:create')
  async genericUpload(@Body() uploadBody: any): Promise<FileResponseDto> {
    return await this.bucketsService.genericUpload(uploadBody);
  }
}
