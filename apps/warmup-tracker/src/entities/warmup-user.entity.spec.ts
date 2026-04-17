import { getMetadataArgsStorage } from 'typeorm';
import { WarmupUserEntity } from './warmup-user.entity';

describe('WarmupUserEntity', () => {
  it('should be defined', () => {
    expect(WarmupUserEntity).toBeDefined();
  });

  it('should be mapped to the warmup_users table', () => {
    const storage = getMetadataArgsStorage();
    const tableMetadata = storage.tables.find(t => t.target === WarmupUserEntity);
    expect(tableMetadata).toBeDefined();
    expect(tableMetadata?.name).toBe('warmup_users');
  });

  it('should have an id primary column', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(c => c.target === WarmupUserEntity);
    const idColumn = columns.find(c => c.propertyName === 'id');
    expect(idColumn).toBeDefined();
  });

  it('should have an email column', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(c => c.target === WarmupUserEntity);
    const emailColumn = columns.find(c => c.propertyName === 'email');
    expect(emailColumn).toBeDefined();
  });

  it('should have a name column', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(c => c.target === WarmupUserEntity);
    const nameColumn = columns.find(c => c.propertyName === 'name');
    expect(nameColumn).toBeDefined();
  });

  it('should have an isInternal column mapped to is_internal', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(c => c.target === WarmupUserEntity);
    const col = columns.find(c => c.propertyName === 'isInternal');
    expect(col).toBeDefined();
    expect(col?.options?.name).toBe('is_internal');
  });

  it('should have a slackId column mapped to slack_id', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter(c => c.target === WarmupUserEntity);
    const col = columns.find(c => c.propertyName === 'slackId');
    expect(col).toBeDefined();
    expect(col?.options?.name).toBe('slack_id');
  });

  it('should instantiate correctly', () => {
    const user = new WarmupUserEntity();
    expect(user).toBeInstanceOf(WarmupUserEntity);
  });
});
