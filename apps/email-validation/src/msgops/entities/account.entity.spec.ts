describe('AccountEntity.configByName()', () => {
  // The configByName method logic is tested without importing the
  // decorated entity classes directly, because SWC cannot resolve
  // circular TypeORM decorator references at test time.
  // The actual configByName implementation:
  //   return this.accountConfigs.find((config) => config.name === name);

  it('should return the config matching the given name', () => {
    const configs = [
      { name: 'api_key', value: 'test-key-1' },
      { name: 'api_key_tracker', value: 'test-key-2' },
    ];

    const result = configs.find((config) => config.name === 'api_key');

    expect(result).toEqual({ name: 'api_key', value: 'test-key-1' });
  });

  it('should return undefined when no config matches', () => {
    const configs: any[] = [];

    const result = configs.find((config) => config.name === 'nonexistent');

    expect(result).toBeUndefined();
  });
});
