export class ContactRepositoryMock {
  async save(obj: any) {
    expect(obj).toHaveProperty('name');
    expect(obj).toHaveProperty('email');
    expect(obj).toHaveProperty('phone');
    expect(obj).toHaveProperty('emailProvider');
    expect(obj.name).toBe('Test 01');
    expect(obj.email).toBe('test01@test.com');
    expect(obj.emailProvider).toBe('test');
    expect(obj.phone).toBe('(00) 00000000');
  }
}
