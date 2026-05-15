import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { SequenceAdvancerService } from './sequence-advancer.service';

describe('SequenceAdvancerService', () => {
  let service: SequenceAdvancerService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [SequenceAdvancerService, { provide: getDataSourceToken(), useValue: dataSource }],
    }).compile();
    service = moduleRef.get(SequenceAdvancerService);
  });

  it('advance executa pg_get_serial_sequence + setval', async () => {
    dataSource.query.mockResolvedValueOnce([{ seq: 'public.accounts_id_seq' }]).mockResolvedValueOnce([{ setval: 10 }]);
    await service.advance('accounts', 'id');
    expect(dataSource.query).toHaveBeenCalledWith(`SELECT pg_get_serial_sequence($1, $2) AS seq`, ['accounts', 'id']);
    expect(dataSource.query.mock.calls[1][0]).toContain('setval');
  });

  it('advance silenciosamente quando sequence não existe', async () => {
    dataSource.query.mockResolvedValueOnce([{ seq: null }]);
    await service.advance('foo', 'bar');
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('ensureInstanceTablesEmpty retorna ok quando accounts vazia', async () => {
    dataSource.query.mockResolvedValueOnce([{ c: 0 }]);
    await expect(service.ensureInstanceTablesEmpty()).resolves.toEqual({ ok: true });
  });

  it('ensureInstanceTablesEmpty rejeita com offending quando accounts tem dados', async () => {
    dataSource.query.mockResolvedValueOnce([{ c: 5 }]);
    await expect(service.ensureInstanceTablesEmpty()).resolves.toEqual({ ok: false, offending: 'accounts' });
  });
});
