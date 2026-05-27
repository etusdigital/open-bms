export class BucketsProviderMock {
  async upload(obj: any) {
    expect(obj).toHaveProperty('name');
    expect(obj.name).toBe('file-name.png');
    expect(obj).toHaveProperty('ext');
    expect(obj.ext).toBe('.png');
    expect(obj).toHaveProperty('mime');
    expect(obj.mime).toBe('image/png');
    expect(obj).toHaveProperty('buffer');
    expect(obj.buffer).toBeInstanceOf(Buffer);
    expect(obj).toHaveProperty('hash');
    expect(obj.hash).toBe('dorprazer');
    expect(obj).toHaveProperty('path');
    expect(obj.path).toBe('tmp/msgops');
    return {};
  }
}
