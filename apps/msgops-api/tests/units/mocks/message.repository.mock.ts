export class MessageRepositoryMock {
  async findOneOrFail(id: number) {
    expect(id).toBe(1);
    return {};
  }

  merge(obj1: any, obj2: any) {
    expect(obj1).toHaveProperty('name');
    expect(obj1.name).toBe('file-name.png');
    expect(obj1).toHaveProperty('ext');
    expect(obj1.ext).toBe('.png');
    expect(obj1).toHaveProperty('mime');
    expect(obj1.mime).toBe('image/png');
    expect(obj2).toHaveProperty('buffer');
    expect(obj2.buffer).toBeInstanceOf(Buffer);
    expect(obj2).toHaveProperty('hash');
    expect(obj2.hash).toBe('dorprazer');
    expect(obj2).toHaveProperty('path');
    expect(obj2.path).toBe('tmp/msgops');
    return {};
  }

  async update(id: number, obj: any) {
    expect(id).toBe(1);
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
  }
  async softDelete(id: number) {
    expect(id).toBe(1);
  }

  create(obj: any) {
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

  async save(obj: any) {
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

  async find() {
    return [];
  }
}
