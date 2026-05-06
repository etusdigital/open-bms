describe('AppModule — boot-time provider validation (F8)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws on invalid EMAIL_VALIDATION_PROVIDER value', async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = 'notavalidprovider';

    await expect(async () => {
      await import('./app.module');
    }).rejects.toThrow(/Invalid EMAIL_VALIDATION_PROVIDER: notavalidprovider/);
  });

  it('throws when emailable selected but EMAILABLE_API_KEY is missing (F2)', async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = 'emailable';
    process.env.EMAILABLE_URL = 'https://api.emailable.com/v1/verify';
    delete process.env.EMAILABLE_API_KEY;

    await expect(async () => {
      await import('./app.module');
    }).rejects.toThrow(/EMAIL_VALIDATION_PROVIDER=emailable requires.*EMAILABLE_API_KEY/);
  });

  it('throws when emailable selected but EMAILABLE_URL is missing', async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = 'emailable';
    process.env.EMAILABLE_API_KEY = 'k';
    delete process.env.EMAILABLE_URL;

    await expect(async () => {
      await import('./app.module');
    }).rejects.toThrow(/EMAILABLE_URL/);
  });

  it('accepts trimmed/uppercase values (F4)', async () => {
    process.env.EMAIL_VALIDATION_PROVIDER = '  NOOP  ';

    await expect(import('./app.module')).resolves.toBeDefined();
  });
});
