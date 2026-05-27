import { Utils } from './index.utils';

describe('Utils', () => {
  let utils: Utils;

  beforeEach(() => {
    utils = new Utils();
  });

  it('stripString should remove html tags', () => {
    expect(utils.stripString('<b>Hello</b> world')).toBe('Hello world');
    expect(utils.stripString('plain text')).toBe('plain text');
  });

  it('slugify should normalize accents and handle empty values', () => {
    expect(utils.slugify('ação Útil')).toBe('acao util');
    expect(utils.slugify('')).toBe('');
    expect(utils.slugify(undefined as never)).toBe('');
  });

  it('breakArrayInChunks should split data and handle invalid size', () => {
    expect(utils.breakArrayInChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);

    const original = [1, 2, 3];
    expect(utils.breakArrayInChunks(original, 0)).toBe(original);
  });

  it('createQueryParams should serialize objects and handle nullish values', () => {
    expect(utils.createQueryParams({ a: 1, b: 'two' })).toBe('a=1&b=two');
    expect(utils.createQueryParams(null as never)).toBe('');
    expect(utils.createQueryParams(undefined as never)).toBe('');
  });

  it('getDomainFromUrl should extract host', () => {
    expect(utils.getDomainFromUrl('https://example.com/path?x=1')).toBe('example.com');
  });

  it('hasVariable should detect template variables', () => {
    expect(utils.hasVariable('Hello %NAME%')).toBe(true);
    expect(utils.hasVariable('Hello NAME')).toBe(false);
    expect(utils.hasVariable(undefined as never)).toBe(false);
  });

  it('parseVariables should replace known variables', () => {
    const account = { customFields: [] };
    const contact = {
      name: 'John',
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      email: 'john@example.com',
      hashedEmail: 'abc',
      phone: '1199999999',
      uuid: 'uuid-1',
      customFields: {},
      link: 'https://example.com/profile',
    };

    const content = 'Hi %NAME% - %EMAIL%';
    expect(utils.parseVariables(content, contact as never, account as never, 'en-US', 'UTC')).toBe(
      'Hi John - john@example.com'
    );
  });

  it('parseContent should evaluate handlebars syntax', () => {
    const account = { customFields: [] };
    const contact = {
      name: 'Ana',
      firstName: 'Ana',
      lastName: '',
      fullName: 'Ana',
      email: 'ana@example.com',
      hashedEmail: 'def',
      phone: '',
      uuid: 'uuid-2',
      customFields: { plan: 'pro' },
      link: '',
    };

    expect(utils.parseContent('Hello {{name}}', contact as never, account as never, 'en-US', 'UTC')).toBe('Hello Ana');
    expect(utils.parseContent('Plan: {{plan | free}}', contact as never, account as never, 'en-US', 'UTC')).toBe(
      'Plan: pro'
    );
  });

  it('getDateFormatted should return formatted values for date/hour tokens', () => {
    expect(utils.getDateFormatted('dateToday', 'en-US', 'UTC')).toBeTruthy();
    expect(utils.getDateFormatted('dateTomorrow', 'en-US', 'UTC')).toBeTruthy();
    expect(utils.getDateFormatted('monthNext', 'en-US', 'UTC')).toBeTruthy();
    expect(utils.getDateFormatted('hourNext8Hours', 'en-US', 'UTC')).toBeTruthy();
  });

  it('getCustomFieldContact should return custom field value or empty string', () => {
    const contact = { customFields: { cpf: '123' } };
    expect(utils.getCustomFieldContact(contact as never, 'cpf')).toBe('123');
    expect(utils.getCustomFieldContact(contact as never, 'missing')).toBe('');
    expect(utils.getCustomFieldContact({ customFields: {} } as never, 'cpf')).toBe('');
  });

  it('mapVariables should map custom fields, tracked links and onlyKeyName mode', () => {
    const account = {
      customFields: [{ name: 'favoriteColor' }],
    };
    const contact = {
      name: 'Ana',
      firstName: 'Ana',
      lastName: 'Silva',
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      hashedEmail: 'hash',
      phone: '11999999999',
      uuid: 'uuid-1',
      customFields: {
        favoriteColor: 'blue',
      },
      link: '',
    };
    const replaceLinks = {
      TRACK_A: {
        url: 'https://example.com/page?x=1',
        host: 'example.com',
      },
    };

    const mapped = utils.mapVariables(contact as never, account as never, replaceLinks, 'en-US', 'UTC', true);

    expect(mapped.NAME).toBe('Ana');
    expect(mapped.FAVORITECOLOR).toBe('blue');
    expect(mapped.TRACK_A).toContain('https://bmsclick.example.com/redirect?url=');
  });

  it('mapVariables should use {{UUID}} fallback when contact uuid is missing', () => {
    const account = { customFields: [] };
    const contact = {
      name: 'Test',
      firstName: '',
      lastName: '',
      fullName: '',
      email: '',
      hashedEmail: '',
      phone: '',
      uuid: undefined,
      customFields: {},
      link: '',
    };
    const replaceLinks = {
      TRACK_B: {
        url: 'https://example.com/page',
        host: 'example.com',
      },
    };

    const mapped = utils.mapVariables(contact as never, account as never, replaceLinks, 'en-US', 'UTC');
    expect(mapped['%TRACK_B%']).toContain('https://bmsclick.example.com/redirect?url=');
    // The URL is base64-encoded, decode and check for {{UUID}} fallback
    const base64Part = mapped['%TRACK_B%'].split('url=')[1];
    const decoded = Buffer.from(base64Part, 'base64').toString();
    expect(decoded).toContain('bmsu={{UUID}}');
  });

  it('mapVariables should handle onlyKeyName = false (default)', () => {
    const account = { customFields: [] };
    const contact = {
      name: 'Test',
      firstName: '',
      lastName: '',
      fullName: '',
      email: '',
      hashedEmail: '',
      phone: '',
      uuid: 'u1',
      customFields: {},
      link: '',
    };

    const mapped = utils.mapVariables(contact as never, account as never, false, 'en-US', 'UTC');
    expect(mapped['%NAME%']).toBe('Test');
  });

  it('mapVariables should handle account with no customFields', () => {
    const account = { customFields: undefined };
    const contact = {
      name: 'Test',
      firstName: '',
      lastName: '',
      fullName: '',
      email: '',
      hashedEmail: '',
      phone: '',
      uuid: 'u1',
      customFields: {},
      link: '',
    };

    const mapped = utils.mapVariables(contact as never, account as never, false, 'en-US', 'UTC');
    expect(mapped['%NAME%']).toBe('Test');
  });

  it('getCustomFieldContact should return empty for array customFields', () => {
    const contact = { customFields: [{ contactId: 1, customFieldId: 1, value: 'x' }] };
    expect(utils.getCustomFieldContact(contact as never, 'test')).toBe('');
  });

  it('getCustomFieldContact should return empty when customFields is undefined', () => {
    const contact = { customFields: undefined };
    expect(utils.getCustomFieldContact(contact as never, 'test')).toBe('');
  });

  it('parseVariables should return content unchanged when no variables present', () => {
    const account = { customFields: [] };
    const contact = { name: 'John' };
    const content = 'No variables here';

    expect(utils.parseVariables(content, contact as never, account as never, 'en-US', 'UTC')).toBe(content);
  });

  it('getDateFormatted should handle dayWeekToday', () => {
    expect(utils.getDateFormatted('dayWeekToday', 'en-US', 'UTC')).toBeTruthy();
  });

  it('getDateFormatted should handle dayWeekTomorrow', () => {
    expect(utils.getDateFormatted('dayWeekTomorrow', 'en-US', 'UTC')).toBeTruthy();
  });

  it('getDateFormatted should handle hourNow', () => {
    expect(utils.getDateFormatted('hourNow', 'en-US', 'UTC')).toBeTruthy();
  });

  it('getDateFormatted should handle hourNextHour', () => {
    expect(utils.getDateFormatted('hourNextHour', 'en-US', 'UTC')).toBeTruthy();
  });

  it('getDateFormatted should handle monthToday', () => {
    expect(utils.getDateFormatted('monthToday', 'en-US', 'UTC')).toBeTruthy();
  });

  it('preprocessTemplate should use fallback value when context field is null', () => {
    const template = '{{ missing | default_value }}';
    const context = {};
    expect(utils.preprocessTemplate(template, context)).toBe('default_value');
  });

  it('preprocessTemplate should use context value when field exists', () => {
    const template = '{{ name | default_value }}';
    const context = { name: 'John' };
    expect(utils.preprocessTemplate(template, context)).toBe('John');
  });

  it('getVariables should include custom fields from account', () => {
    const customFields = [{ name: 'cpf' }, { name: 'city' }];
    const vars = utils.getVariables(customFields as never);
    expect((vars as any).cpf).toBe('%CPF%');
    expect((vars as any).city).toBe('%CITY%');
  });

  it('getVariables should handle custom fields without name property (string array)', () => {
    const customFields = ['cpf', 'city'] as any;
    const vars = utils.getVariables(customFields);
    expect((vars as any).cpf).toBe('%CPF%');
    expect((vars as any).city).toBe('%CITY%');
  });

  it('parseContent should handle content with both variables and handlebars', () => {
    const account = { customFields: [] };
    const contact = {
      name: 'Ana',
      firstName: 'Ana',
      lastName: '',
      fullName: '',
      email: 'ana@test.com',
      hashedEmail: '',
      phone: '',
      uuid: '',
      customFields: { plan: 'premium' },
      link: '',
    };

    const content = 'Hello %NAME%, your plan is {{plan}}';
    const result = utils.parseContent(content, contact as never, account as never, 'en-US', 'UTC');
    expect(result).toBe('Hello Ana, your plan is premium');
  });

  it('getDomainFromUrl should handle URLs with ports', () => {
    expect(utils.getDomainFromUrl('https://example.com:8080/path')).toBe('example.com:8080');
  });

  it('mapVariables should use link from customFields when contact.link is empty', () => {
    const account = { customFields: [] };
    const contact = {
      name: 'Test',
      firstName: '',
      lastName: '',
      fullName: '',
      email: '',
      hashedEmail: '',
      phone: '',
      uuid: 'u1',
      customFields: { link: 'https://custom-link.com' },
      link: '',
    };

    const mapped = utils.mapVariables(contact as never, account as never, false, 'en-US', 'UTC');
    expect(mapped['%LINK%']).toBe('https://custom-link.com');
  });
});
