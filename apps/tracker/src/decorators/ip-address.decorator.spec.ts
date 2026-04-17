import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { IpAddress } from './ip-address.decorator';

// Helper to extract the decorator factory function
function getParamDecoratorFactory(decorator: (...args: any[]) => ParameterDecorator) {
  class Test {
    public test(@decorator() value: string) {
      return value;
    }
  }

  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('IpAddress Decorator', () => {
  let factory: (...args: any[]) => any;

  beforeEach(() => {
    factory = getParamDecoratorFactory(IpAddress);
  });

  it('should return clientIp when available on request', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ clientIp: '1.2.3.4' }),
      }),
    } as ExecutionContext;

    const result = factory(null, mockContext);
    expect(result).toBe('1.2.3.4');
  });

  it('should fall back to request-ip when clientIp is not set', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-forwarded-for': '5.6.7.8' },
          connection: {},
        }),
      }),
    } as ExecutionContext;

    const result = factory(null, mockContext);
    expect(result).toBe('5.6.7.8');
  });

  it('should return null when no IP information is available', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          connection: {},
        }),
      }),
    } as ExecutionContext;

    const result = factory(null, mockContext);
    expect(result).toBeNull();
  });
});
