import stream from 'stream';

import { GetBucketsResponse, GetFilesResponse, Storage } from '@google-cloud/storage';
import { FileResponseDto } from '../modules/buckets/file-response.dto';

export class GoogleCloudStorageProvider {
  private storage: Storage;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.storage = new Storage(options);
  }

  async checkBucket(bucketName) {
    try {
      const bucket = this.storage.bucket(bucketName);
      const [exists] = await bucket.exists();
      if (!exists) {
        throw new Error(`An error occurs when we try to retrieve the Bucket "${bucketName}". Check if bucket exist on Google Cloud Platform.`);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async getFilesForBucket(): Promise<GetFilesResponse> {
    try {
      return await this.storage.bucket(process.env.BUCKET_NAME).getFiles();
    } catch (error) {
      if (error.code === 404) {
        console.warn('Bucket was not found.');
      } else {
        console.error(error);
        throw error;
      }
    }
  }

  async getBuckets(): Promise<GetBucketsResponse> {
    try {
      return await this.storage.getBuckets();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async delete(file) {
    const fileName = `${file.path}/${file.hash}`;
    try {
      await this.storage
        .bucket(file.bucketName || process.env.BUCKET_NAME)
        .file(fileName)
        .delete();
      console.debug(`File ${fileName} successfully deleted`);
    } catch (error) {
      if (error.code === 404) {
        console.warn('Remote file was not found, you may have to delete manually.');
      } else {
        console.error(error);
        throw error;
      }
    }
  }

  async upload(isAutomatedMessage: boolean, templateId: number | string, file: any, pathExternal?: string): Promise<FileResponseDto> {
    try {
      let pathFolderName = 'templates/messages';
      if (pathExternal) {
        pathFolderName = pathExternal;
      }

      if (!templateId) {
        templateId = `tmp-${new Date().getTime()}`;
      }

      const fullFilePath = `${pathFolderName}/${templateId}/images/${file.name}`;

      const bucketName = process.env.BUCKET_NAME;
      const bucket = this.storage.bucket(bucketName);

      const folder = bucket.file(`${pathFolderName}/${templateId}/`);
      const [exists] = await folder.exists();
      if (!exists) {
        folder.save('', (err) => {
          console.log(err);
        });
      }

      const imageFolder = bucket.file(`${pathFolderName}/${templateId}/images/`);
      const [existsImageFolder] = await imageFolder.exists();
      if (!existsImageFolder) {
        imageFolder.save(null, (err) => {
          console.log(err);
        });
      }

      const bucketFile = bucket.file(fullFilePath);

      const [fileExists] = await bucketFile.exists();
      if (fileExists) {
        console.info('File already exists. Trying to remove it.');
        await this.delete(file);
      }

      const fileAttributes = {
        contentType: file.mime,
        metadata: {
          contentDisposition: `inline; filename="${file.name}"`,
        },
        public: true,
      };

      const fullFileName = `${pathFolderName}/${templateId}/images/${file.name}`;
      file.url = `https://${process.env.BUCKET_NAME}/${fullFileName}`;

      await bucketFile.save(file.buffer, fileAttributes);

      return {
        name: file.name,
        link: file.url,
      };
    } catch (error) {
      console.error(`Error uploading file to Google Cloud Storage: ${error.message}`);
      throw error;
    }
  }

  async genericUpload(file: any, fileName: string, pathFolderName: string, bucketName?: string, isPublic?: boolean): Promise<FileResponseDto> {
    try {
      const fullFilePath = `${pathFolderName}/${fileName}`;

      bucketName = bucketName || process.env.BUCKET_NAME;
      const bucket = this.storage.bucket(bucketName);

      const folder = bucket.file(`${pathFolderName}/`);
      const [exists] = await folder.exists();
      if (!exists) {
        folder.save('', (err) => {
          console.log(err);
        });
      }

      const bucketFile = bucket.file(fullFilePath);

      const [fileExists] = await bucketFile.exists();
      if (fileExists) {
        console.info('File already exists. Trying to remove it.');
        await this.delete({ path: pathFolderName, hash: fileName, bucketName });
      }

      const fileAttributes = {
        contentType: file.mime,
        metadata: {
          contentDisposition: `inline; filename="${file.name}"`,
          public: isPublic || false,
          cacheControl: file.cacheControl || 'public, max-age=3600',
        },
        public: isPublic || false,
      };

      const fullFileName = `${pathFolderName}/${file.name}`;
      file.url = `https://${bucketName}/${fullFileName}`;

      await bucketFile.save(file.buffer || file.content, fileAttributes);

      return {
        name: file.name,
        link: file.url,
      };
    } catch (error) {
      console.error(`Error uploading file to Google Cloud Storage: ${error.message}`);
      throw error;
    }
  }

  async writeContentIntoBucketFile(templateId: any, content: string, isTemporary = false): Promise<any> {
    if (process.env.NODE_ENV !== 'production') {
      return {
        bucketName: process.env.BUCKET_NAME,
        fullFilePath: `templates/messages/${templateId}/template.html`,
        fileURLPath: `https://${process.env.BUCKET_NAME}/templates/messages/${templateId}/template.html`,
      };
    }
    let pathFolderName = 'templates/messages';
    if (isTemporary) {
      // This folder has a GCP Storage rule to auto delete in 1 day
      // https://cloud.google.com/storage/docs/lifecycle
      pathFolderName = 'templates/auto-delete-in-1-day';
    }

    const fullFilePath = `${pathFolderName}/${templateId}/template.html`;
    const bucketName = process.env.BUCKET_NAME;
    const bucket = this.storage.bucket(bucketName);

    const folder = bucket.file(`${pathFolderName}/${templateId}/`);

    const [exists] = await folder.exists();

    if (!exists) {
      folder.save('', (err) => {
        if (err) {
          console.log('Error to create folder on cloud storage:', err);
        }
      });
    }

    const remotePath = fullFilePath;
    const localReadStream = new stream.PassThrough();

    localReadStream.end(content);

    const remoteWriteStream = bucket.file(remotePath).createWriteStream({
      contentType: 'text/html',
      metadata: {
        contentType: 'text/html',
      },
      public: true,
    });

    return new Promise((resolve, reject) => {
      localReadStream
        .pipe(remoteWriteStream)
        .on('error', (err) => {
          console.error(`Error uploading file to Google Cloud Storage: ${err}`);
          reject(`Error uploading file to Google Cloud Storage: ${err}`);
        })
        .on('finish', () => {
          const fileURLPath = `https://${process.env.BUCKET_NAME}/${fullFilePath}`;
          resolve({
            bucketName,
            fullFilePath,
            fileURLPath,
          });
        });
    });
  }
}
