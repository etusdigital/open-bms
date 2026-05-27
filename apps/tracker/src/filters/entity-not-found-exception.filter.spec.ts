import { EntityNotFoundExceptionFilter } from './entity-not-found-exception.filter';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';

describe('EntityNotFoundExceptionFilter', () => {
  let filter: EntityNotFoundExceptionFilter;

  beforeEach(() => {
    filter = new EntityNotFoundExceptionFilter();
  });

  it('should return 404 with uuid when EntityNotFoundError is caught', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus };

    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as any;

    const error = new EntityNotFoundError('Contact', { id: 1 });
    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: { statusCode: 404, error: 'Not Found' },
        uuid: expect.any(String),
      }),
    );
  });
});
