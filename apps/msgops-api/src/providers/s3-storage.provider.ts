import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileResponseDto } from '../modules/buckets/file-response.dto';
import { SystemConfigCacheProvider } from './system-config-cache.provider';
import type { S3SystemSettings } from '../lib/integrations-config-file';
import { S3_KEY } from '../modules/admin-integrations/s3/admin-s3.service';

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
// HTML templates are read by send-email's StorageService, which caps the
// stream-to-string at 5 MB. Keep both sides in sync — a write the consumer
// can't read is just a delayed failure.
const MAX_HTML_BYTES = 5 * 1024 * 1024;

interface ResolvedS3 {
  client: S3Client;
  bucket: string;
  assetsUrl?: string;
  endpoint?: string;
  useObjectAcls: boolean;
}

@Injectable()
export class S3StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private cached: { hash: string; resolved: ResolvedS3 } | null = null;

  constructor(private readonly cache: SystemConfigCacheProvider) {}

  // Resolves the active S3 client + bucket from system_config. Memoizes the
  // S3Client by a hash of the connection-relevant fields so we don't recreate
  // it on every call, but still pick up changes when the operator updates
  // settings via UI (the cache provider invalidates on save).
  private async resolve(): Promise<ResolvedS3> {
    const settings = await this.cache.get<S3SystemSettings>(S3_KEY);
    if (!settings) {
      throw new ServiceUnavailableException('S3 não configurado — configure em /super-admin/integrations/s3.');
    }
    const useObjectAcls = settings.useObjectAcls !== false;
    const hash = JSON.stringify({
      e: settings.endpoint,
      r: settings.region,
      a: settings.accessKeyId,
      s: settings.secretAccessKey,
    });
    if (this.cached?.hash === hash) {
      // Refresh non-connection fields (bucket, assetsUrl, ACL flag) without recreating the client.
      this.cached.resolved.bucket = settings.bucket;
      this.cached.resolved.assetsUrl = settings.assetsUrl;
      this.cached.resolved.useObjectAcls = useObjectAcls;
      return this.cached.resolved;
    }
    const client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region ?? 'us-east-1',
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      forcePathStyle: !!settings.endpoint,
    });
    const resolved: ResolvedS3 = {
      client,
      bucket: settings.bucket,
      assetsUrl: settings.assetsUrl,
      endpoint: settings.endpoint,
      useObjectAcls,
    };
    this.cached = { hash, resolved };
    return resolved;
  }

  async getDefaultBucket(): Promise<string> {
    return (await this.resolve()).bucket;
  }

  async getAssetsUrl(): Promise<string | undefined> {
    return (await this.resolve()).assetsUrl;
  }

  async delete(file: { path: string; hash: string; bucketName?: string }): Promise<void> {
    const r = await this.resolve();
    const key = `${file.path}/${file.hash}`;
    const bucket = file.bucketName || r.bucket;
    try {
      await r.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
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
    const r = await this.resolve();
    const pathFolderName = pathExternal || 'templates/messages';
    const resolvedTemplateId = templateId || `tmp-${Date.now()}`;
    const key = `${pathFolderName}/${resolvedTemplateId}/images/${file.name}`;

    await this.putObject(r, {
      bucket: r.bucket,
      key,
      body: file.buffer,
      contentType: file.mime,
      contentDisposition: `inline; filename="${file.name}"`,
      isPublic: true,
    });

    const link = this.publicUrl(r, r.bucket, key);
    file.url = link;
    return { name: file.name, link };
  }

  async genericUpload(file: any, fileName: string, pathFolderName: string, bucketName?: string, isPublic?: boolean): Promise<FileResponseDto> {
    const r = await this.resolve();
    const bucket = bucketName || r.bucket;
    const key = `${pathFolderName}/${fileName}`;

    await this.putObject(r, {
      bucket,
      key,
      body: file.buffer || file.content,
      contentType: file.mime,
      contentDisposition: `inline; filename="${file.name}"`,
      cacheControl: file.cacheControl || 'public, max-age=3600',
      isPublic: Boolean(isPublic),
    });

    const link = this.publicUrl(r, bucket, key);
    file.url = link;
    return { name: file.name, link };
  }

  async writeContentIntoBucketFile(templateId: any, content: string, isTemporary = false): Promise<{ bucketName: string; fullFilePath: string; fileURLPath: string }> {
    const r = await this.resolve();
    const bucketName = r.bucket;
    const pathFolderName = isTemporary ? 'templates/auto-delete-in-1-day' : 'templates/messages';
    const fullFilePath = `${pathFolderName}/${templateId}/template.html`;
    const fileURLPath = this.publicUrl(r, bucketName, fullFilePath);

    await this.putObject(r, {
      bucket: bucketName,
      key: fullFilePath,
      body: Buffer.from(content, 'utf8'),
      contentType: 'text/html',
      isPublic: true,
      maxBytes: MAX_HTML_BYTES,
    });

    return { bucketName, fullFilePath, fileURLPath };
  }

  private async putObject(
    r: ResolvedS3,
    params: {
      bucket: string;
      key: string;
      body: Buffer | string;
      contentType?: string;
      contentDisposition?: string;
      cacheControl?: string;
      isPublic?: boolean;
      maxBytes?: number;
    },
  ): Promise<void> {
    const body = typeof params.body === 'string' ? Buffer.from(params.body, 'utf8') : params.body;
    const maxBytes = params.maxBytes ?? MAX_ASSET_BYTES;
    if (body.length > maxBytes) {
      throw new Error(`Upload to ${params.bucket}/${params.key} exceeds ${maxBytes} bytes`);
    }

    try {
      await r.client.send(
        new PutObjectCommand({
          Bucket: params.bucket,
          Key: params.key,
          Body: body,
          ContentType: params.contentType,
          ContentDisposition: params.contentDisposition,
          CacheControl: params.cacheControl,
          ACL: params.isPublic && r.useObjectAcls ? 'public-read' : undefined,
        }),
      );
    } catch (error) {
      this.logger.error(`Error uploading ${params.key} to ${params.bucket}: ${(error as Error).message}`);
      throw error;
    }
  }

  private publicUrl(r: ResolvedS3, bucket: string, key: string): string {
    const assetsHost = r.assetsUrl;
    if (assetsHost) {
      // BMS_ASSETS_URL fronts a single bucket. If a caller writes to a
      // different bucket the URL will silently point to the wrong origin —
      // surface it loudly instead of returning a broken link.
      if (r.bucket && bucket && bucket !== r.bucket) {
        this.logger.warn(`publicUrl: bucket '${bucket}' differs from default '${r.bucket}'; URL via assetsUrl may be wrong`);
      }
      return `https://${assetsHost}/${key}`;
    }
    if (r.endpoint) {
      return `${r.endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
}
