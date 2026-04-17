import { Injectable } from '@nestjs/common';
import { GoogleCloudStorageProvider } from '../../providers/google-cloud-storage.provider';
import { FileResponseDto } from './file-response.dto';
import { FileUploadDto } from './file-upload.dto';
import { replaceSpecialChars } from '../../utils/utils.service';
import * as crypto from 'crypto';
import sharp from 'sharp';

@Injectable()
export class BucketsService {
  constructor(private readonly gcsProvider: GoogleCloudStorageProvider) {}

  async uploadFilesToGCS(filesUpload: Array<FileUploadDto>): Promise<Array<FileResponseDto>> {
    const processedFiles: FileResponseDto[] = await Promise.all(
      filesUpload.map(async (file) => {
        const { messageId, isAutomatedMessage, name, data } = file;

        const extension = name.substring(name.lastIndexOf('.'));
        const cleanName = replaceSpecialChars(name.split(extension).shift()) + extension;

        const fileDTO = {
          name: cleanName,
          ext: extension,
          mime: data.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1],
          buffer: Buffer.from(data.replace(/^data:image\/\w+;base64,/, ''), 'base64'),
          hash: crypto.createHash('md5').update(cleanName).digest('hex'),
          path: 'tmp/msgops',
        };

        return await this.gcsProvider.upload(isAutomatedMessage, messageId, fileDTO, file.pathExternal);
      }),
    );

    return processedFiles;
  }

  async compressAndEncodeImage(base64Image, options = { fit: sharp.fit.contain, width: 300 }) {
    try {
      const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);

      if (!match) {
        throw new Error('Invalid base64 image format. Please check the input and try again.');
      }

      const format = match[1];
      const base64Data = match[2];

      const buffer = Buffer.from(base64Data, 'base64');

      const compressedBuffer = await sharp(buffer).unflatten().resize(options).toBuffer();

      const compressedBase64 = compressedBuffer.toString('base64');

      return `data:${format};base64,${compressedBase64}`;
    } catch (error) {
      console.error('Error compressing image:', error);
      throw new Error('Failed to compress image. Please check the image format and try again.', { cause: error });
    }
  }

  async genericUpload(fileUpload: any): Promise<FileResponseDto> {
    const { name, data, pathFolderName, isPublic } = fileUpload;

    const compressedData = await this.compressAndEncodeImage(data);

    const extension = name.substring(name.lastIndexOf('.'));
    const cleanName = replaceSpecialChars(name.split(extension).shift()) + extension;

    const fileDTO = {
      name: cleanName,
      ext: extension,
      mime: compressedData.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)[1],
      buffer: Buffer.from(compressedData.replace(/^data:image\/\w+;base64,/, ''), 'base64'),
      hash: crypto.createHash('md5').update(cleanName).digest('hex'),
      path: 'tmp/msgops',
    };

    return await this.gcsProvider.genericUpload(fileDTO, cleanName, pathFolderName, process.env.BUCKET_NAME, isPublic);
  }
}
