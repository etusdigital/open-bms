export class AccountMessageRepositoryMock {
  async find(obj: any) {
    expect(obj).toHaveProperty('message');
    expect(obj.message).toHaveProperty('id');
    expect(obj.message.id).toBe(1);
    return [];
  }

  async softDelete(obj: any) {
    expect(obj).toHaveProperty('message');
    expect(obj.message).toHaveProperty('id');
    expect(obj.message.id).toBe(1);
  }

  async save(obj: any) {
    expect(obj).toHaveProperty('accountIdExternal');
    expect(obj.accountIdExternal).toBe('test-account');
    expect(obj).toHaveProperty('testId');
    expect(obj.testId).toBe('test-id');
    expect(obj).toHaveProperty('accountName');
    expect(obj.accountName).toBe('test account');
    expect(obj).toHaveProperty('message');
    expect(obj.message).toHaveProperty('id');
    expect(obj.message.id).toBe(1);
  }

  async update(id: number, obj: any) {
    expect(id).toBe(1);
    expect(obj).toHaveProperty('testId');
    expect(obj.testId).toBe('test-id');
    expect(obj).toHaveProperty('activeCampaignAccountId');
    expect(obj.activeCampaignAccountId).toBe('test-account');
  }
}
