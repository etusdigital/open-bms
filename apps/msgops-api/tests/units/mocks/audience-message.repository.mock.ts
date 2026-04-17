export class AudienceMessageRepositoryMock {
  async find(obj: any) {
    expect(obj).toHaveProperty('message');
    expect(obj.message).toHaveProperty('id');
    expect(obj.message.id).toBe(1);
    return [];
  }

  async save(obj: any) {
    expect(obj).toHaveProperty('audienceIdExternal');
    expect(obj.audienceIdExternal).toBe(1);
    expect(obj).toHaveProperty('audienceName');
    expect(obj.audienceName).toBe('test-audience');
    expect(obj).toHaveProperty('message');
    expect(obj.message).toHaveProperty('id');
    expect(obj.message.id).toBe(1);
  }
}
