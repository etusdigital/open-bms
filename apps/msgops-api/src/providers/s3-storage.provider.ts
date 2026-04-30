import { Injectable, Logger } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileResponseDto } from '../modules/buckets/file-response.dto';

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
// HTML templates are read by send-email's StorageService, which caps the
// stream-to-string at 5 MB. Keep both sides in sync — a write the consumer
// can't read is just a delayed failure.
const MAX_HTML_BYTES = 5 * 1024 * 1024;

// AWS buckets created after April 2023 default to BucketOwnerEnforced and
// reject object ACLs. Set S3_USE_OBJECT_ACLS=false in those environments and
// grant read via bucket policy instead. MinIO and pre-2023 buckets default
// to ACL-enabled, so the flag stays opt-out (true when unset).
const useObjectAcls = (): boolean => process.env.S3_USE_OBJECT_ACLS !== 'false';

@Injectable()
export class S3StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
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

  async delete(file: { path: string; hash: string; bucketName?: string }): Promise<void> {
    const key = `${file.path}/${file.hash}`;
    const bucket = file.bucketName || process.env.S3_BUCKET;
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      this.logger.debug(`File ${key} successfully deleted`);
    } catch (error) {
      // Match the GCS provider's prior behavior: a missing object is a no-op
      // for cleanup callers — re-throwing would break idempotent retry paths.
      const err = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
      const isNotFound = err?.name === 'NoSuchKey' || err?.Code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
      if (isNotFound) {
        this.logger.warn(`Remote file ${key} not found in ${bucket}, ignoring delete`);
        return;
      }
      this.logger.error(`Error deleting ${key} from ${bucket}: ${(error as Error).message}`);
      throw error;
    }
  }

  async upload(templateId: number | string, file: any, pathExternal?: string): Promise<FileResponseDto> {
    const pathFolderName = pathExternal || 'templates/messages';
    const resolvedTemplateId = templateId || `tmp-${Date.now()}`;
    const key = `${pathFolderName}/${resolvedTemplateId}/images/${file.name}`;
    const bucket = process.env.S3_BUCKET;

    await this.putObject({
      bucket,
      key,
      body: file.buffer,
      contentType: file.mime,
      contentDisposition: `inline; filename="${file.name}"`,
      isPublic: true,
    });

    const link = this.publicUrl(bucket, key);
    file.url = link;
    return { name: file.name, link };
  }

  async genericUpload(file: any, fileName: string, pathFolderName: string, bucketName?: string, isPublic?: boolean): Promise<FileResponseDto> {
    const bucket = bucketName || process.env.S3_BUCKET;
    const key = `${pathFolderName}/${fileName}`;

    await this.putObject({
      bucket,
      key,
      body: file.buffer || file.content,
      contentType: file.mime,
      contentDisposition: `inline; filename="${file.name}"`,
      cacheControl: file.cacheControl || 'public, max-age=3600',
      isPublic: Boolean(isPublic),
    });

    const link = this.publicUrl(bucket, key);
    file.url = link;
    return { name: file.name, link };
  }

  async writeContentIntoBucketFile(templateId: any, content: string, isTemporary = false): Promise<{ bucketName: string; fullFilePath: string; fileURLPath: string }> {
    const bucketName = process.env.S3_BUCKET;
    const pathFolderName = isTemporary ? 'templates/auto-delete-in-1-day' : 'templates/messages';
    const fullFilePath = `${pathFolderName}/${templateId}/template.html`;
    const fileURLPath = this.publicUrl(bucketName, fullFilePath);

    await this.putObject({
      bucket: bucketName,
      key: fullFilePath,
      body: Buffer.from(content, 'utf8'),
      contentType: 'text/html',
      isPublic: true,
      maxBytes: MAX_HTML_BYTES,
    });

    return { bucketName, fullFilePath, fileURLPath };
  }

  private async putObject(params: {
    bucket: string;
    key: string;
    body: Buffer | string;
    contentType?: string;
    contentDisposition?: string;
    cacheControl?: string;
    isPublic?: boolean;
    maxBytes?: number;
  }): Promise<void> {
    const body = typeof params.body === 'string' ? Buffer.from(params.body, 'utf8') : params.body;
    const maxBytes = params.maxBytes ?? MAX_ASSET_BYTES;
    if (body.length > maxBytes) {
      throw new Error(`Upload to ${params.bucket}/${params.key} exceeds ${maxBytes} bytes`);
    }

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          Body: body,
          ContentType: params.contentType,
          ContentDisposition: params.contentDisposition,
          CacheControl: params.cacheControl,
          ACL: params.isPublic && useObjectAcls() ? 'public-read' : undefined,
        }),
      );
    } catch (error) {
      this.logger.error(`Error uploading ${params.key} to ${params.bucket}: ${(error as Error).message}`);
      throw error;
    }
  }

  private publicUrl(bucket: string, key: string): string {
    const assetsHost = process.env.BMS_ASSETS_URL;
    if (assetsHost) {
      // BMS_ASSETS_URL fronts a single bucket. If a caller writes to a
      // different bucket the URL will silently point to the wrong origin —
      // surface it loudly instead of returning a broken link.
      const defaultBucket = process.env.S3_BUCKET;
      if (defaultBucket && bucket && bucket !== defaultBucket) {
        this.logger.warn(`publicUrl: bucket '${bucket}' differs from S3_BUCKET '${defaultBucket}'; URL via BMS_ASSETS_URL may be wrong`);
      }
      return `https://${assetsHost}/${key}`;
    }
    const endpoint = process.env.S3_ENDPOINT;
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
}
