import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IdMapperService } from './id-mapper.service';
import { EnterpriseIdMappingEntity } from './entities/enterprise-id-mapping.entity';

describe('IdMapperService', () => {
  let service: IdMapperService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => ({
        insert: () => ({
          into: () => ({ values: () => ({ orIgnore: () => ({ execute: jest.fn().mockResolvedValue({}) }) }) }),
        }),
      })),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [IdMapperService, { provide: getRepositoryToken(EnterpriseIdMappingEntity), useValue: repo }],
    }).compile();
    service = moduleRef.get(IdMapperService);
  });

  it('record + resolve roundtrip in account scope', async () => {
    await service.record('job1', 'tags', 42, 100);
    expect(service.resolve('job1', 'account', 'tags', 42)).toBe('100');
  });

  it('resolve in instance scope returns the identity id', () => {
    expect(service.resolve('job1', 'instance', 'tags', 99)).toBe('99');
  });

  it('resolve returns null when the mapping is missing', () => {
    expect(service.resolve('job1', 'account', 'tags', 999)).toBeNull();
  });

  it('loadFromDb hydrates the cache', async () => {
    repo.find.mockResolvedValue([
      { jobId: 'job1', entity: 'tags', sourceId: '1', newId: '101' },
      { jobId: 'job1', entity: 'tags', sourceId: '2', newId: '102' },
    ]);
    await service.loadFromDb('job1');
    expect(service.resolve('job1', 'account', 'tags', 1)).toBe('101');
    expect(service.resolve('job1', 'account', 'tags', 2)).toBe('102');
  });
});
