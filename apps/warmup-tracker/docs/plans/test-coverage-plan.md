# Test Coverage Plan: warmup-tracker

## Objective

Increase automated test coverage of the `warmup-tracker` service from its current state (< 10%, 2 tests in a single spec file) to a minimum of **80% line coverage** and **75% branch coverage** across all source files. All tests must be deterministic, fast (no real network or DB calls), and run via `npm test` / `pnpm test`.

## Current State

| Metric | Current | Target |
|---|---|---|
| Spec files | 1 | 4+ |
| Total tests | 2 | 30+ |
| Line coverage | < 10% | >= 80% |
| Branch coverage | Unknown | >= 75% |
| Statement coverage | Unknown | >= 80% |
| Function coverage | < 10% | >= 80% |

### Files Currently Untested

- `src/app.service.ts` — contains `notify()`, `parsePayload()`, `removePlaceholders()`
- `src/slack/slack.service.ts` — contains `sendMessage()`
- `src/entities/warmup-user.entity.ts` — TypeORM entity
- `src/app.controller.ts` — only partially tested (2 tests, likely smoke-level only)

## Testing Strategy

### Framework and Tooling

- **Test runner**: Jest 29.7.0 (already installed)
- **NestJS test utilities**: `@nestjs/testing` (`Test.createTestingModule`)
- **Mocking**: Jest built-in mocks (`jest.fn()`, `jest.mock()`, `jest.spyOn()`)
- **TypeORM mocking**: Use `getRepositoryToken()` from `@nestjs/typeorm` + Jest mock repository
- **Slack mocking**: Mock `@slack/web-api` `WebClient` at module level

### Test File Locations

All spec files live alongside their source files (NestJS convention):

```
src/
  app.controller.spec.ts         (existing — expand)
  app.service.spec.ts            (new)
  slack/
    slack.service.spec.ts        (new)
  entities/
    warmup-user.entity.spec.ts   (new)
```

## File-by-File Test Plans

---

### 1. `src/app.controller.spec.ts` (Expand Existing)

**Current**: 2 tests (likely app instantiation + basic route check)

**Target**: 8-10 tests

**Test Cases**:

```
AppController
  POST /notify
    - should return 200 and call AppService.notify() with the correct payload
    - should return the result from AppService.notify()
    - should return 400 when body is missing required fields (if validation pipe is active)
    - should return 500 (or rethrow) when AppService.notify() throws
    - should handle an empty body gracefully
  AppController bootstrap
    - should be defined
    - should inject AppService correctly
```

**Mocking Strategy**:
- Mock `AppService` with `jest.fn()` for all methods
- Use `Test.createTestingModule` with `AppController` and a mock provider for `AppService`

**Example Structure**:

```typescript
describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            notify: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = moduleRef.get(AppController);
    appService = moduleRef.get(AppService);
  });

  it('should be defined', () => {
    expect(appController).toBeDefined();
  });

  it('should call appService.notify with the request body', async () => {
    const payload = { email: 'test@example.com', event: 'opened' };
    appService.notify.mockResolvedValueOnce({ success: true });

    const result = await appController.notify(payload);

    expect(appService.notify).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ success: true });
  });

  it('should propagate errors from appService.notify', async () => {
    appService.notify.mockRejectedValueOnce(new Error('DB error'));
    await expect(appController.notify({})).rejects.toThrow('DB error');
  });
});
```

---

### 2. `src/app.service.spec.ts` (New)

**Target**: 15-20 tests

**Methods to test**:

#### 2a. `AppService.notify(payload)`

This is the core orchestration method. It likely:
1. Calls `parsePayload()` to clean/transform the input
2. Queries the `WarmupUser` repository to find user context
3. Builds a Slack Block Kit message
4. Calls `SlackService.sendMessage()` with the built message

**Test Cases**:

```
AppService.notify()
  - should call parsePayload() with the incoming payload
  - should query the WarmupUser repository using the email from the payload
  - should build a Block Kit message with the correct user data
  - should include a Gmail deep-link button in the Slack message
  - should call SlackService.sendMessage() with the constructed blocks
  - should return successfully when Slack responds OK
  - should throw/log an error when the WarmupUser is not found in the database
  - should throw/log an error when SlackService.sendMessage() fails
  - should call removePlaceholders() on text fields before sending
  - should handle a payload with all optional fields absent
  - should handle a payload with all optional fields present
```

**Mocking Strategy**:
- Mock `WarmupUserRepository` using `getRepositoryToken(WarmupUser)` provider
- Mock `SlackService.sendMessage` as a `jest.fn()`
- Do NOT make real DB or Slack calls

**Example Structure**:

```typescript
describe('AppService', () => {
  let appService: AppService;
  let warmupUserRepository: jest.Mocked<Repository<WarmupUser>>;
  let slackService: jest.Mocked<SlackService>;

  const mockWarmupUser: WarmupUser = {
    id: 1,
    email: 'warmup@example.com',
    slackChannel: 'C0123456789',
    name: 'Test User',
    // ...other fields
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: getRepositoryToken(WarmupUser),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: SlackService,
          useValue: {
            sendMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    appService = moduleRef.get(AppService);
    warmupUserRepository = moduleRef.get(getRepositoryToken(WarmupUser));
    slackService = moduleRef.get(SlackService);
  });

  describe('notify()', () => {
    it('should query the repository with the payload email', async () => {
      warmupUserRepository.findOne.mockResolvedValue(mockWarmupUser);
      slackService.sendMessage.mockResolvedValue(undefined);

      await appService.notify({ email: 'warmup@example.com', event: 'reply' });

      expect(warmupUserRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'warmup@example.com' } }),
      );
    });

    it('should throw when user is not found', async () => {
      warmupUserRepository.findOne.mockResolvedValue(null);
      await expect(
        appService.notify({ email: 'unknown@example.com', event: 'reply' }),
      ).rejects.toThrow();
    });

    it('should call SlackService.sendMessage with Block Kit blocks', async () => {
      warmupUserRepository.findOne.mockResolvedValue(mockWarmupUser);
      slackService.sendMessage.mockResolvedValue(undefined);

      await appService.notify({ email: 'warmup@example.com', event: 'reply' });

      expect(slackService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: mockWarmupUser.slackChannel,
          blocks: expect.arrayContaining([expect.any(Object)]),
        }),
      );
    });
  });
```

#### 2b. `AppService.parsePayload(raw)`

This method transforms/normalizes incoming payload data.

**Test Cases**:

```
AppService.parsePayload()
  - should return a normalized object from a valid raw payload
  - should trim whitespace from string fields
  - should handle undefined optional fields without throwing
  - should handle null values gracefully
  - should extract the email field correctly
  - should extract the event type correctly
  - should map known event types to display labels
  - should preserve unknown event types as-is (or map to 'Unknown')
```

#### 2c. `AppService.removePlaceholders(text)`

This method cleans placeholder strings (e.g., `{{firstName}}`, `{name}`) from text.

**Test Cases**:

```
AppService.removePlaceholders()
  - should remove double-brace placeholders: '{{firstName}}' -> ''
  - should remove single-brace placeholders: '{name}' -> ''
  - should remove multiple placeholders in a single string
  - should leave non-placeholder text unchanged
  - should handle an empty string input
  - should handle a string with no placeholders
  - should handle undefined input gracefully (return empty string or original)
  - should trim leading/trailing whitespace after placeholder removal
```

---

### 3. `src/slack/slack.service.spec.ts` (New)

**Target**: 6-8 tests

**Methods to test**:

#### `SlackService.sendMessage(options)`

**Test Cases**:

```
SlackService
  - should be defined
  sendMessage()
    - should call WebClient.chat.postMessage with the provided options
    - should include the channel from options in the API call
    - should include the blocks array in the API call
    - should resolve successfully when Slack API returns ok: true
    - should throw an error when Slack API returns ok: false
    - should throw an error when WebClient.chat.postMessage rejects
    - should include the text fallback when provided
```

**Mocking Strategy**:
- Mock `@slack/web-api` at module level using `jest.mock('@slack/web-api')`
- Mock `WebClient` constructor to return a controlled mock instance
- Control the return value of `chat.postMessage`

**Example Structure**:

```typescript
import { WebClient } from '@slack/web-api';

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: {
      postMessage: jest.fn(),
    },
  })),
}));

describe('SlackService', () => {
  let slackService: SlackService;
  let mockWebClient: { chat: { postMessage: jest.Mock } };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SlackService,
        // Provide SLACK_TOKEN if injected via ConfigService or @Inject
        {
          provide: 'SLACK_TOKEN',
          useValue: 'xoxb-test-token',
        },
      ],
    }).compile();

    slackService = moduleRef.get(SlackService);
    mockWebClient = (WebClient as jest.Mock).mock.results[0].value;
  });

  it('should be defined', () => {
    expect(slackService).toBeDefined();
  });

  it('should call chat.postMessage with the correct arguments', async () => {
    mockWebClient.chat.postMessage.mockResolvedValueOnce({ ok: true });

    await slackService.sendMessage({
      channel: 'C0123456789',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }],
    });

    expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C0123456789' }),
    );
  });

  it('should throw when chat.postMessage returns ok: false', async () => {
    mockWebClient.chat.postMessage.mockResolvedValueOnce({
      ok: false,
      error: 'channel_not_found',
    });

    await expect(
      slackService.sendMessage({ channel: 'INVALID', blocks: [] }),
    ).rejects.toThrow();
  });

  it('should propagate rejection from chat.postMessage', async () => {
    mockWebClient.chat.postMessage.mockRejectedValueOnce(
      new Error('network error'),
    );

    await expect(
      slackService.sendMessage({ channel: 'C0123456789', blocks: [] }),
    ).rejects.toThrow('network error');
  });
});
```

---

### 4. `src/entities/warmup-user.entity.spec.ts` (New)

**Target**: 4-6 tests

TypeORM entity tests focus on verifying that the entity class is correctly decorated and instantiated — they do not require a real database connection.

**Test Cases**:

```
WarmupUser entity
  - should be defined as a class
  - should have an @Entity() decorator targeting 'warmup_users' table
  - should have a primary generated column 'id'
  - should have an 'email' column
  - should have a 'slackChannel' column (or 'slack_channel' mapped)
  - should instantiate with default values where applicable
```

**Example Structure**:

```typescript
import { getMetadataArgsStorage } from 'typeorm';
import { WarmupUser } from './warmup-user.entity';

describe('WarmupUser Entity', () => {
  it('should be defined', () => {
    expect(WarmupUser).toBeDefined();
  });

  it('should be mapped to the warmup_users table', () => {
    const storage = getMetadataArgsStorage();
    const tableMetadata = storage.tables.find(
      (t) => t.target === WarmupUser,
    );
    expect(tableMetadata).toBeDefined();
    expect(tableMetadata?.name).toBe('warmup_users');
  });

  it('should have an id primary column', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter((c) => c.target === WarmupUser);
    const idColumn = columns.find((c) => c.propertyName === 'id');
    expect(idColumn).toBeDefined();
  });

  it('should have an email column', () => {
    const storage = getMetadataArgsStorage();
    const columns = storage.columns.filter((c) => c.target === WarmupUser);
    const emailColumn = columns.find((c) => c.propertyName === 'email');
    expect(emailColumn).toBeDefined();
  });

  it('should instantiate correctly', () => {
    const user = new WarmupUser();
    expect(user).toBeInstanceOf(WarmupUser);
  });
});
```

---

## Jest Configuration Updates

Update `jest` configuration in `package.json` (or `jest.config.js`) to enforce coverage thresholds:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "lines": 80,
        "branches": 75,
        "functions": 80,
        "statements": 80
      }
    },
    "collectCoverageFrom": [
      "src/**/*.ts",
      "!src/**/*.spec.ts",
      "!src/main.ts",
      "!src/**/*.module.ts",
      "!src/migrations/**"
    ]
  }
}
```

Run coverage:

```bash
npm run test:cov
# or after pnpm migration:
pnpm test:cov
```

## Implementation Order

1. Write `app.service.spec.ts` first — highest business value, covers the most logic
2. Write `slack.service.spec.ts` — isolates the Slack SDK interaction
3. Expand `app.controller.spec.ts` — builds on service mocks already defined
4. Write `warmup-user.entity.spec.ts` — straightforward metadata checks
5. Update Jest config to enforce thresholds
6. Run `npm run test:cov` and verify all thresholds pass

## Definition of Done

- [ ] `src/app.service.spec.ts` exists with >= 15 test cases
- [ ] `src/slack/slack.service.spec.ts` exists with >= 6 test cases
- [ ] `src/app.controller.spec.ts` expanded to >= 7 test cases
- [ ] `src/entities/warmup-user.entity.spec.ts` exists with >= 4 test cases
- [ ] `npm run test` exits with code 0 (all tests pass)
- [ ] `npm run test:cov` reports >= 80% lines, >= 75% branches
- [ ] No real network or database connections are made during test runs
- [ ] Jest `coverageThreshold` is configured and enforced
