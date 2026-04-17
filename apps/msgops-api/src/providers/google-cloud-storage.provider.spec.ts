import { GoogleCloudStorageProvider } from './google-cloud-storage.provider';

describe('GoogleCloudStorageProvider', () => {
  let provider: GoogleCloudStorageProvider;

  beforeEach(async () => {
    jest.mock('@google-cloud/storage');
    provider = new GoogleCloudStorageProvider();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  /** @TODO */
});
