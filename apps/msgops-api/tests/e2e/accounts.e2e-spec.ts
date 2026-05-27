import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AccountsModule } from '../../src/modules/accounts/accounts.module';

describe('Accounts', () => {
  let app: INestApplication;
  let savedPostAccount: any;

  const key = Date.now();
  const data = {
    name: `account_test_${key}`,
    defaultDomain: `account.test.com.br_${key}`,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(), AccountsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test(`/POST`, async () => {
    const response = await request(app.getHttpServer()).post('/accounts').send(data);

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(data.name);
    expect(response.body.defaultDomain).toBe(data.defaultDomain);
    expect(response.body.createdAt).toBeTruthy();
    expect(response.body.deletedAt).toBeFalsy();
    expect(response.body.id).toBeTruthy();
    savedPostAccount = response.body;
  });

  test(`/GET findAll`, async () => {
    const response = await request(app.getHttpServer()).get('/accounts');

    expect(response.body.length).toBeGreaterThanOrEqual(1);
    expect(response.status).toBe(200);
  });

  test(`/GET :id`, async () => {
    const response = await request(app.getHttpServer()).get(`/accounts/${savedPostAccount.id}`);

    expect(response.body.id).toBe(savedPostAccount.id);
    expect(response.status).toBe(200);
  });

  test(`/PUT :id`, async () => {
    const newData = { ...data, defaultAddress: 'Rua Teste, Belo Horizonte, MG' };
    const response = await request(app.getHttpServer())
      .put(`/accounts/${savedPostAccount.id}`)
      .send({ ...newData });

    expect(response.body.id).toBe(savedPostAccount.id);
    expect(response.body.name).toBe(newData.name);
    expect(response.body.defaultDomain).toBe(newData.defaultDomain);
    expect(response.body.defaultAddress).toBe(newData.defaultAddress);
    expect(response.status).toBe(200);
  });

  test(`/DELETE :id`, async () => {
    const response = await request(app.getHttpServer()).delete(`/accounts/${savedPostAccount.id}`);

    expect(response.body.message).toBe('Account deleted successfully');
    expect(response.status).toBe(200);
  });
});
