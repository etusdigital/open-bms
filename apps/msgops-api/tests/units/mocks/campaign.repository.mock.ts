export class CampaignRepositoryMock {
  private campaign = {
    title: 'test',
    id: 1,
    createdAt: new Date(),
  };

  async findOneOrFail(id: number) {
    expect(id).toBe(1);
    return this.campaign;
  }

  async findAndCount(obj: any) {
    if (obj.take === 1) {
      expect(obj).toHaveProperty('take');
      expect(obj.take).toBe(1);
      expect(obj).toHaveProperty('skip');
      expect(obj.skip).toBe(2);
      expect(obj).toHaveProperty('order');
      expect(obj.order).toHaveProperty('createdAt');
      expect(obj.order.createdAt).toBe('DESC');
      return [[], 0];
    } else {
      expect(obj).toHaveProperty('take');
      expect(obj.take).toBe(10);
      expect(obj).toHaveProperty('skip');
      expect(obj.skip).toBe(10);
      expect(obj).toHaveProperty('order');
      expect(obj.order).toHaveProperty('createdAt');
      expect(obj.order.createdAt).toBe('DESC');
      return [[this.campaign], 1];
    }
  }

  merge(obj1: any, obj2: any) {
    expect(obj1).toHaveProperty('title');
    expect(obj1.title).toBe('test');
    expect(obj2).toHaveProperty('title');
    expect(obj2.title).toBe('title-edit');

    obj1.title = obj2.title;
  }

  async update(id: number, obj: any) {
    expect(id).toBe(1);
    expect(obj).toHaveProperty('title');
    expect(obj.title).toBe('title-edit');
    return obj;
  }

  async softDelete(id: number) {
    expect(id).toBe(1);
  }

  create(obj: any) {
    expect(obj).toHaveProperty('title');
    expect(obj.title).toBe('test');
    return obj;
  }

  async save(obj: any) {
    expect(obj).toHaveProperty('title');
    expect(obj.title).toBe('test');
    return this.campaign;
  }

  async find() {
    return [this.campaign];
  }
}
