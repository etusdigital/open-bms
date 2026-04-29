import { Injectable, Logger } from '@nestjs/common';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const MAX_HTML_BYTES = 5 * 1024 * 1024;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;

  constructor() {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT;

    this.s3 = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
      forcePathStyle: Boolean(endpoint),
    });
  }

  async getHtml(bucketName: string, filename: string): Promise<string> {
    this.logger.log(`getHtml ${bucketName}/${filename}`);
    const response = await this.s3.send(new GetObjectCommand({ Bucket: bucketName, Key: filename }));
    const body = response.Body;
    if (!body) return '';
    return await this.streamToString(body as Readable, `${bucketName}/${filename}`);
  }

  private async streamToString(stream: Readable, source: string): Promise<string> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_HTML_BYTES) {
        throw new Error(`HTML payload from ${source} exceeds ${MAX_HTML_BYTES} bytes`);
      }
      chunks.push(buf);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}
