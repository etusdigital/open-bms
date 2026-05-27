import { typeOrmConfig } from './ormconfig';

describe('OrmConfig', () => {
  it('should export a valid TypeORM configuration', () => {
    expect(typeOrmConfig).toBeDefined();
    expect(typeOrmConfig.type).toBe('postgres');
  });

  it('should use environment variables for connection', () => {
    expect(typeOrmConfig).toHaveProperty('host');
    expect(typeOrmConfig).toHaveProperty('port');
    expect(typeOrmConfig).toHaveProperty('username');
    expect(typeOrmConfig).toHaveProperty('password');
    expect(typeOrmConfig).toHaveProperty('database');
  });

  it('should have entity and migration paths configured', () => {
    expect(typeOrmConfig.entities).toEqual(['dist/**/*.entity.js']);
    expect(typeOrmConfig.migrations).toEqual(['dist/**/migrations/*.js']);
  });
});
