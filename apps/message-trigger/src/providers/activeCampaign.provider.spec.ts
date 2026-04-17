import { Test, TestingModule } from '@nestjs/testing';
import { ActiveCampaignProvider } from './activeCampaign.provider';
import { HttpService } from '@nestjs/axios';
import { InternalServerErrorException } from '@nestjs/common';
import { ContactEntity } from '../msgops/entities/contact.entity';
import { of, throwError } from 'rxjs';

describe('ActiveCampaignProvider', () => {
  let provider: ActiveCampaignProvider;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActiveCampaignProvider],
    }).compile();

    provider = module.get<ActiveCampaignProvider>(ActiveCampaignProvider);
    httpService = provider['httpService'];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(provider).toBeDefined();
    });

    it('should initialize HttpService', () => {
      expect(provider['httpService']).toBeDefined();
      expect(provider['httpService']).toBeInstanceOf(HttpService);
    });
  });

  describe('createContact', () => {
    const mockContact: ContactEntity = {
      id: 123,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+5511999999999',
    } as ContactEntity;

    const mockStepSettings = {
      apiKey: 'test-api-key-123',
      accountName: 'test-account',
      list: {
        id: 5,
        name: 'Newsletter List',
      },
    };

    describe('Successful contact creation', () => {
      it('should create contact and add to list when status is 201', async () => {
        // Arrange
        const mockCreateResponse = {
          status: 201,
          data: {
            contact: {
              id: '456',
              email: mockContact.email,
              firstName: mockContact.firstName,
              lastName: mockContact.lastName,
            },
          },
        };

        const mockAddToListResponse = {
          status: 200,
          data: {
            contactList: {
              contact: '456',
              list: 5,
              status: 1,
            },
          },
        };

        const postSpy = jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockCreateResponse) as any)
          .mockReturnValueOnce(of(mockAddToListResponse) as any);

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(postSpy).toHaveBeenCalledTimes(2);

        // First call: create contact
        expect(postSpy).toHaveBeenNthCalledWith(
          1,
          'https://test-account.api-us1.com/api/3/contacts',
          {
            contact: {
              email: mockContact.email,
              firstName: mockContact.firstName,
              lastName: mockContact.lastName,
              phone: mockContact.phone,
            },
          },
          {
            headers: {
              'content-type': 'application/json',
              'Api-Token': 'test-api-key-123',
            },
          },
        );

        // Second call: add to list
        expect(postSpy).toHaveBeenNthCalledWith(
          2,
          'https://test-account.api-us1.com/api/3/contactLists',
          {
            contactList: {
              list: 5,
              contact: '456',
              status: 1,
            },
          },
          {
            headers: {
              'content-type': 'application/json',
              'Api-Token': 'test-api-key-123',
            },
          },
        );

        expect(result).toEqual(mockCreateResponse.data);
      });

      it('should include all contact fields in payload', async () => {
        // Arrange
        const fullContact: ContactEntity = {
          id: 789,
          email: 'full@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1234567890',
        } as ContactEntity;

        const mockResponse = {
          status: 201,
          data: { contact: { id: '999' } },
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockResponse) as any)
          .mockReturnValueOnce(of({ status: 200, data: {} }) as any);

        // Act
        await provider.createContact(fullContact, mockStepSettings);

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          {
            contact: {
              email: 'full@example.com',
              firstName: 'Jane',
              lastName: 'Smith',
              phone: '+1234567890',
            },
          },
          expect.any(Object),
        );
      });

      it('should use correct API endpoint with account name', async () => {
        // Arrange
        const customSettings = {
          ...mockStepSettings,
          accountName: 'custom-account-xyz',
        };

        const mockResponse = {
          status: 201,
          data: { contact: { id: '111' } },
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockResponse) as any)
          .mockReturnValueOnce(of({ status: 200, data: {} }) as any);

        // Act
        await provider.createContact(mockContact, customSettings);

        // Assert
        expect(httpService.post).toHaveBeenNthCalledWith(1, 'https://custom-account-xyz.api-us1.com/api/3/contacts', expect.any(Object), expect.any(Object));
      });

      it('should include Api-Token header from stepSettings', async () => {
        // Arrange
        const customSettings = {
          ...mockStepSettings,
          apiKey: 'super-secret-key-789',
        };

        const mockResponse = {
          status: 201,
          data: { contact: { id: '222' } },
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockResponse) as any)
          .mockReturnValueOnce(of({ status: 200, data: {} }) as any);

        // Act
        await provider.createContact(mockContact, customSettings);

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(expect.any(String), expect.any(Object), {
          headers: {
            'content-type': 'application/json',
            'Api-Token': 'super-secret-key-789',
          },
        });
      });

      it('should return response data on success', async () => {
        // Arrange
        const mockResponse = {
          status: 201,
          data: {
            contact: {
              id: '333',
              email: mockContact.email,
              cdate: '2024-01-15T10:00:00Z',
            },
          },
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockResponse) as any)
          .mockReturnValueOnce(of({ status: 200, data: {} }) as any);

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(result).toEqual(mockResponse.data);
      });

      it('should return empty object when response.data is undefined', async () => {
        // Arrange
        const mockResponse = {
          status: 200, // Non-201 status to avoid calling addToList
        };

        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(result).toEqual({});
      });
    });

    describe('Duplicate contact handling', () => {
      it('should handle duplicate contact with status 422 and duplicate error code', async () => {
        // Arrange
        const mockDuplicateResponse = {
          status: 422,
          data: {
            errors: [
              {
                code: 'duplicate',
                title: 'Contact already exists',
              },
            ],
          },
        };

        jest.spyOn(httpService, 'post').mockReturnValue(of(mockDuplicateResponse) as any);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(consoleLogSpy).toHaveBeenCalledWith('[ACTIVE-CAMPAIGN] - Contact already exists');
        expect(result).toBeUndefined();
        expect(httpService.post).toHaveBeenCalledTimes(1); // Should not try to add to list

        consoleLogSpy.mockRestore();
      });

      it('should handle duplicate error thrown with "code 422" message', async () => {
        // Arrange
        const mockError = new Error('Request failed with status code 422');
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(consoleLogSpy).toHaveBeenCalledWith('[ACTIVE-CAMPAIGN] - Contact already exists');
        expect(result).toBeUndefined();

        consoleLogSpy.mockRestore();
      });

      it('should not add contact to list when duplicate is detected', async () => {
        // Arrange
        const mockDuplicateResponse = {
          status: 422,
          data: {
            errors: [{ code: 'duplicate' }],
          },
        };

        const postSpy = jest.spyOn(httpService, 'post').mockReturnValue(of(mockDuplicateResponse) as any);

        // Act
        await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(postSpy).toHaveBeenCalledTimes(1); // Only create contact call, no add to list
      });
    });

    describe('Non-201 status codes', () => {
      it('should not add to list when status is not 201', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          data: { contact: { id: '444' } },
        };

        const postSpy = jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(postSpy).toHaveBeenCalledTimes(1); // Only create contact, no add to list
        expect(result).toEqual(mockResponse.data);
      });

      it('should return data for status 200', async () => {
        // Arrange
        const mockResponse = {
          status: 200,
          data: { message: 'Updated' },
        };

        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(result).toEqual(mockResponse.data);
      });
    });

    describe('Error handling', () => {
      it('should throw InternalServerErrorException for non-duplicate errors', async () => {
        // Arrange
        const mockError = new Error('Network error');
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);

        // Act & Assert
        await expect(provider.createContact(mockContact, mockStepSettings)).rejects.toThrow(InternalServerErrorException);
      });

      it('should include error details in exception message', async () => {
        // Arrange
        const mockError = { message: 'API error', code: 500 };
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);

        // Act & Assert
        await expect(provider.createContact(mockContact, mockStepSettings)).rejects.toThrow(`[ACTIVE-CAMPAIGN] - Error to send: ${JSON.stringify(mockError)}`);
      });

      it('should handle 401 Unauthorized error', async () => {
        // Arrange
        const mockError = {
          response: { status: 401, statusText: 'Unauthorized' },
          message: 'Invalid API token',
        };
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);

        // Act & Assert
        await expect(provider.createContact(mockContact, mockStepSettings)).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle 500 Server Error', async () => {
        // Arrange
        const mockError = {
          response: { status: 500, statusText: 'Internal Server Error' },
          message: 'Server error',
        };
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);

        // Act & Assert
        await expect(provider.createContact(mockContact, mockStepSettings)).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle error on second API call (add to list)', async () => {
        // Arrange
        const mockCreateResponse = {
          status: 201,
          data: { contact: { id: '555' } },
        };
        const mockError = new Error('Failed to add to list');

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockCreateResponse) as any)
          .mockReturnValueOnce(throwError(() => mockError) as any);

        // Act & Assert
        await expect(provider.createContact(mockContact, mockStepSettings)).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('Edge cases', () => {
      it('should handle contact with null phone', async () => {
        // Arrange
        const contactNoPhone = {
          ...mockContact,
          phone: null,
        } as ContactEntity;

        const mockResponse = {
          status: 201,
          data: { contact: { id: '666' } },
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockResponse) as any)
          .mockReturnValueOnce(of({ status: 200, data: {} }) as any);

        // Act
        await provider.createContact(contactNoPhone, mockStepSettings);

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          {
            contact: {
              email: contactNoPhone.email,
              firstName: contactNoPhone.firstName,
              lastName: contactNoPhone.lastName,
              phone: null,
            },
          },
          expect.any(Object),
        );
      });

      it('should handle contact with empty firstName/lastName', async () => {
        // Arrange
        const minimalContact = {
          ...mockContact,
          firstName: '',
          lastName: '',
        } as ContactEntity;

        const mockResponse = {
          status: 201,
          data: { contact: { id: '777' } },
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockResponse) as any)
          .mockReturnValueOnce(of({ status: 200, data: {} }) as any);

        // Act
        await provider.createContact(minimalContact, mockStepSettings);

        // Assert
        expect(httpService.post).toHaveBeenCalledWith(
          expect.any(String),
          {
            contact: {
              email: minimalContact.email,
              firstName: '',
              lastName: '',
              phone: minimalContact.phone,
            },
          },
          expect.any(Object),
        );
      });

      it('should handle different list IDs', async () => {
        // Arrange
        const customSettings = {
          ...mockStepSettings,
          list: { id: 999, name: 'VIP List' },
        };

        const mockResponse = {
          status: 201,
          data: { contact: { id: '888' } },
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(of(mockResponse) as any)
          .mockReturnValueOnce(of({ status: 200, data: {} }) as any);

        // Act
        await provider.createContact(mockContact, customSettings);

        // Assert
        expect(httpService.post).toHaveBeenNthCalledWith(
          2,
          expect.any(String),
          {
            contactList: {
              list: 999,
              contact: '888',
              status: 1,
            },
          },
          expect.any(Object),
        );
      });

      it('should handle error without message property', async () => {
        // Arrange
        const mockError = { code: 'ERR_NETWORK' };
        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError) as any);

        // Act & Assert
        await expect(provider.createContact(mockContact, mockStepSettings)).rejects.toThrow(InternalServerErrorException);
      });

      it('should handle response with null data', async () => {
        // Arrange
        const mockResponse = {
          status: 200, // Non-201 status to avoid calling addToList
          data: null,
        };

        jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

        // Act
        const result = await provider.createContact(mockContact, mockStepSettings);

        // Assert
        expect(result).toEqual({});
      });
    });
  });
});
