import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private storage: Storage;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.storage = new Storage(options);
  }

  async getHtml(bucketName: string, filename: string) {
    console.log('Log - getHtml', filename);
    const file = await this.storage.bucket(bucketName).file(filename).download();

    return file[0].toString('utf8') || '';
  }
}
