import { getClassSchema } from 'nestjs-joi';
import { CreateAccountDto } from './create-account.dto';

describe('CreateAccountDto', () => {
  const schema = getClassSchema(CreateAccountDto);

  it('trims whitespace from account name', () => {
    const { value, error } = schema.validate({ name: '  Consulta Finanças  ' });
    expect(error).toBeUndefined();
    expect(value.name).toBe('Consulta Finanças');
  });

  it('trims leading whitespace from account name', () => {
    const { value, error } = schema.validate({ name: ' MyAccount' });
    expect(error).toBeUndefined();
    expect(value.name).toBe('MyAccount');
  });

  it('requires name to be present', () => {
    const { error } = schema.validate({});
    expect(error).toBeDefined();
    expect(error!.details[0].path).toContain('name');
  });

  it('rejects empty string after trim', () => {
    const { error } = schema.validate({ name: '   ' });
    expect(error).toBeDefined();
  });
});
