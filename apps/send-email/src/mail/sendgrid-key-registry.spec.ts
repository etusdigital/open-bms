import { Test, TestingModule } from '@nestjs/testing';
import { SendGridKeyRegistry } from './sendgrid-key-registry';

describe('SendGridKeyRegistry', () => {
  let registry: SendGridKeyRegistry;

  afterEach(() => {
    delete process.env.SENDGRID_KEYS_MAP;
  });

  async function createRegistry(): Promise<SendGridKeyRegistry> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SendGridKeyRegistry],
    }).compile();

    registry = module.get<SendGridKeyRegistry>(SendGridKeyRegistry);
    return registry;
  }

  describe('onModuleInit', () => {
    it('should load keys from valid SENDGRID_KEYS_MAP', async () => {
      process.env.SENDGRID_KEYS_MAP = JSON.stringify({
        'plusdin-campaigns': 'SG.test-plusdin',
        'easy-campaigns': 'SG.test-easy',
      });

      const registry = await createRegistry();
      registry.onModuleInit();

      expect(registry.getKey('plusdin-campaigns')).toBe('SG.test-plusdin');
      expect(registry.getKey('easy-campaigns')).toBe('SG.test-easy');
    });

    it('should warn but not throw when SENDGRID_KEYS_MAP is not set', async () => {
      delete process.env.SENDGRID_KEYS_MAP;

      const registry = await createRegistry();

      expect(() => registry.onModuleInit()).not.toThrow();
    });

    it('should throw when SENDGRID_KEYS_MAP is invalid JSON', async () => {
      process.env.SENDGRID_KEYS_MAP = 'not-json{';

      const registry = await createRegistry();

      expect(() => registry.onModuleInit()).toThrow('SENDGRID_KEYS_MAP is not valid JSON');
    });
  });

  describe('getKey', () => {
    it('should return the correct key for a valid name', async () => {
      process.env.SENDGRID_KEYS_MAP = JSON.stringify({ 'easy-campaigns': 'SG.my-easy-key' });

      const registry = await createRegistry();
      registry.onModuleInit();

      expect(registry.getKey('easy-campaigns')).toBe('SG.my-easy-key');
    });

    it('should throw when key name is not found', async () => {
      process.env.SENDGRID_KEYS_MAP = JSON.stringify({ 'other-key': 'SG.xxx' });

      const registry = await createRegistry();
      registry.onModuleInit();

      expect(() => registry.getKey('missing-key')).toThrow('SendGrid key "missing-key" not found in SENDGRID_KEYS_MAP');
    });
  });
});
