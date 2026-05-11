describe('AppModule', () => {
  it('loads without errors', async () => {
    await expect(import('./app.module')).resolves.toBeDefined();
  });
});
