# Test Coverage Plan — msgops-api

## Objective

Establish a meaningful automated test suite for msgops-api, targeting >= 80% line and branch coverage across all service classes and providers. The current state is 3 spec files covering 2 services and 1 provider, with ~0% aggregate coverage. This plan produces spec files that work against the **current** stack (NestJS 7, TypeORM 0.2, Jest 29, TypeScript 4) and survive the NestJS 11 upgrade intact.

---

## Current Test Inventory

| File | Class Under Test | Coverage Quality |
|---|---|---|
| `src/modules/automations-messages-accounts/automation-message-account.service.spec.ts` | `AutomationMessageAccountService` | Low — only 3 happy-path tests, no error branches |
| `src/modules/services/services.service.spec.ts` | `ServicesService` | Good — 30+ cases covering `sendEmail` and `processTransactional` branches |
| `src/providers/google-cloud-storage.provider.spec.ts` | `GoogleCloudStorageProvider` | Unknown — file exists but not read |

---

## Testing Principles for This Codebase

### Pattern: NestJS TestingModule with Manual Mocks

All specs in this codebase use `Test.createTestingModule()` with explicit `useValue` or `useClass` mock providers. This is the correct approach for NestJS unit tests — avoid `@Module` integration tests that try to spin up the full DI graph (TypeORM, Redis, GCP SDK connections).

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ServiceUnderTest,
    { provide: getRepositoryToken(SomeEntity), useValue: mockRepository },
    { provide: OtherService, useValue: mockOtherService },
    { provide: ClsService, useValue: { get: jest.fn().mockReturnValue('1') } },
  ],
}).compile();
```

### Pattern: Mock Repository Shape

TypeORM `Repository<T>` exposes: `find`, `findOne`, `findOneBy`, `findAndCount`, `save`, `create`, `update`, `delete`, `softDelete`, `count`, `createQueryBuilder`. Mock only the methods the service under test actually calls. Use `jest.fn()` with `.mockResolvedValue()` for async methods.

```typescript
const mockRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  update: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  }),
};
```

### Pattern: ClsService Mock

All services that read `accountId` or `apiKey` from nestjs-cls context need:

```typescript
const mockClsService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'accountId') return '42';
    if (key === 'apiKey') return 'test-key';
    return undefined;
  }),
};
```

### Pattern: Test Case Categories

For each service method, write test cases covering:
1. Happy path — returns expected result
2. Not found — returns null, throws NotFoundException, or returns `{ status: false }` depending on service convention
3. Invalid input — throws BadRequestException or HttpException
4. External service failure — mock rejects, verify error propagation
5. Authorization failure — wrong accountId, throws UnauthorizedException

---

## Services to Cover (27 services)

Priority is assigned based on business criticality and complexity.

### Priority 1 — Critical Business Logic

These services orchestrate core platform flows. Bugs here mean failed campaigns or lost contacts.

#### 1. `ContactsService` (`src/modules/contacts/contacts.service.ts`)

Dependencies to mock:
- `Repository<ContactEntity>`
- `Repository<ContactTagEntity>`
- `Repository<ContactCustomFieldEntity>`
- `Repository<ContactDeviceEntity>`
- `Repository<SuppressionEntity>`
- `Repository<ContactAutomationEntity>`
- `Repository<EventsLogEntity>`
- `AccountsService`
- `CustomFieldsService`
- `PubSubProvider`
- `ClsService`
- `AuditService`

Key test cases:
```
findByProperty: happy path, not found, with isCompleted flag
findAll: pagination, filters, accountId scoping
create: happy path, duplicate email rejection, suppression check
update: happy path, contact not found, unauthorized accountId
softDelete / bulkDelete: cascades, not found
importCsv: valid CSV, malformed rows, encoding edge cases
cleanPushDevices: empty result, normal run
deactivateInactiveContacts: date threshold logic
```

#### 2. `CampaignsService` (`src/modules/campaigns/campaigns.service.ts`)

Dependencies to mock:
- `Repository<CampaignEntity>`
- `Repository<CampaignMessageEntity>`
- `Repository<CampaignContactEntity>`
- `AccountsService`
- `PoolsService`
- `PubSubProvider`
- `GoogleTasksProvider`
- `ClsService`

Key test cases:
```
findAll: pagination, status filter
create: valid, missing pool, pool not found, A/B test config
start: valid, already started, no contacts
stop: valid, already stopped
lateCampaigns: date logic, empty result
accountsWithoutCampaigns: account list, empty
createWithTestAb: winner percentage validation
```

#### 3. `AutomationsService` (`src/modules/automations/automations.service.ts`)

Dependencies to mock:
- `Repository<AutomationEntity>`
- `Repository<MessageEntity>`
- `Repository<AutomationTargetEntity>`
- `MessagesService`
- `AccountsService`
- `GoogleCloudStorageProvider`
- `GoogleBigqueryProvider`
- `PubSubProvider` (via UtilsModule)
- `ClsService`
- `RedisService` (current: nestjs-redis InjectRedis)

Key test cases:
```
findAll: pagination, accountId scope
findOne: found, not found
create: valid, duplicate keyName
startTestAb / finishTestAb: state machine transitions
keyName: found, not found
messagesAll: correct ordering
```

#### 4. `TagsService` (`src/modules/tags/tags.service.ts`)

Dependencies to mock:
- `Repository<TagEntity>`
- `Repository<ContactTagEntity>`
- `ClsService`
- `PubSubProvider`
- `GoogleTasksProvider`

Key test cases:
```
findAll: segment filter, status filter
create: valid, with segment config
processSegment: valid query, empty result, DB error
addSegmentInfo: valid, tag not found
updateLastCount: correct increment
```

#### 5. `MessagesService` (`src/modules/messages/messages.service.ts`)

Dependencies to mock:
- `Repository<MessageEntity>`
- `Repository<EmailsLabelsEntity>`
- `GoogleCloudStorageProvider`
- `ClsService`

Key test cases:
```
findAll: pagination, accountId scope
findOneByname: found, not found (returns null, not throw)
create: valid draft, missing required fields
update: valid, not found
publish: draft → published transition
messagesAll / messagesName: internal endpoints (no accountId)
```

### Priority 2 — Infrastructure and Integration Services

#### 6. `StatisticsService` (`src/modules/statistics/statistics.service.ts`)

Dependencies to mock:
- `GoogleBigqueryProvider`
- `ClickhouseProvider`
- `Repository<AccountUsageEntity>`
- `Repository<EventStatisticsEntity>`
- `Repository<VerifyStatisticsEntity>`
- `AccountsService`
- `ClsService`
- `GoogleTasksProvider`

Key test cases:
```
aggregatedStatistics: BigQuery mock returns rows, empty result
bfpAccountUsage: normal, zero usage
removeOldDataFromRedis: side-effect verification
usage: per-account with date range
```

#### 7. `AccountsService` (`src/modules/accounts/accounts.service.ts`)

Dependencies to mock:
- `Repository<AccountEntity>`
- `Repository<AccountConfigEntity>`
- `Repository<UserAccountEntity>`
- `Auth0Provider`
- `SendgridHandler`
- `EvolutionHandler`
- `AccountCacheService`
- `GoogleCloudStorageProvider`
- `GoogleTasksProvider`

Key test cases:
```
findWithCleanConfigs: found, not found, config merging
findAll / findOne: pagination, filters
create: valid, duplicate
syncSendgridSubusers: mock SendGrid response
configByName: found, not found
isActive check: inactive account rejection
```

#### 8. `AccountCacheService` (`src/modules/accounts/account-cache.service.ts`)

Dependencies to mock:
- Redis client (via InjectRedis or direct ioredis mock)
- `AccountsService`

Key test cases:
```
getAccount: cache hit, cache miss (fetches from DB and stores)
invalidateAccountCache: key deletion
invalidateAccountCacheAsync: async variant
TTL behavior: verify TTL set on cache write
```

#### 9. `PoolsService` (`src/modules/pools/pools.service.ts`)

Dependencies to mock:
- `Repository<PoolEntity>`
- `ClsService`

Key test cases:
```
findAll: accountId scope
findOneByPool: found, not found
findOneBySenderEmail: found, not found
findDefault: found, none configured
create: valid, warmup pool creation
sendgridIps: mock SendGrid response
```

#### 10. `WarmupsService` (`src/modules/warmups/warmups.service.ts`)

Dependencies to mock:
- `Repository<WarmupEntity>`
- `ClsService`
- `PubSubProvider`
- `GoogleTasksProvider`

Key test cases:
```
create: valid, duplicate pool conflict
processTarget: schedules correctly, pool validation
findAll: stage filter, type filter
advanceStage: valid, already at max stage
```

### Priority 3 — Supporting Services

#### 11. `ServicesService` — ALREADY WELL COVERED

The existing `services.service.spec.ts` is a good reference. Expand with:
- `processTransactional` error propagation edge case when PubSub throws
- Verify `sendEmail` correctly handles `message.name` lookup path

#### 12. `UsersService` (`src/modules/users/users.service.ts`)

Dependencies to mock:
- `Repository<UsersEntity>`
- `Repository<UserAccountEntity>`
- `Auth0Provider`
- `ClsService`

Key test cases:
```
findAll: pagination
create: valid, Auth0 user creation mock, account assignment
update: language, settings, not found
findByProviderId: found, not found
syncFromAuth0: token validation, user upsert
```

#### 13. `EmailsTemplatesService` (`src/modules/emails-templates/emails-templates.service.ts`)

Dependencies to mock:
- `Repository<EmailsTemplatesEntity>`
- `GoogleCloudStorageProvider`
- `ClsService`

Key test cases:
```
findAll: pagination, accountId scope
findOne: found, not found
create: uploads template to GCS, returns URL
update: replaces GCS object
delete: removes GCS object, soft-deletes entity
```

#### 14. `CustomFieldsService` (`src/modules/custom-fields/custom-fields.service.ts`)

Dependencies to mock:
- `Repository<CustomFieldsEntity>`
- `Repository<ContactCustomFieldEntity>`
- `ClsService`

Key test cases:
```
findAll: by accountId
create: valid, duplicate name
update: valid, not found
delete: cascades to contact_custom_fields
addSettingsToCustomField: valid field types (text, number, date, time)
```

#### 15. `CustomEventService` (`src/modules/custom-events/custom-events.service.ts`)

Dependencies to mock:
- `Repository<CustomEventEntity>`
- `ClsService`

Key test cases:
```
findAll: accountId scope
create: valid
update: valid, not found
trigger: emits PubSub message
```

#### 16. `BucketsService` (`src/modules/buckets/buckets.service.ts`)

Dependencies to mock:
- `GoogleCloudStorageProvider`
- `ClsService`

Key test cases:
```
upload: valid file buffer, returns public URL
delete: existing key, not found
list: prefix filter
```

#### 17. `BatchService` (`src/modules/batch/batch.service.ts`)

Dependencies to mock:
- `ContactsService`
- `TagsService`
- `ClsService`

Key test cases:
```
batchTagContacts: valid list, partial failures
batchUntagContacts: valid list
batchDeleteContacts: valid list, max batch size enforcement
```

#### 18. `PostmasterService` (`src/modules/postmaster/postmaster.service.ts`)

Dependencies to mock:
- `Repository<PostmasterEntity>`
- `ClsService`

Key test cases:
```
findAll: accountId scope
create: valid
update: domain verification status
```

#### 19. `LabelsService` (`src/modules/labels/labels.service.ts`)

Dependencies to mock:
- `Repository<LabelsEntity>`
- `Repository<LabelsContentsEntity>`
- `ClsService`

Key test cases:
```
findAll: by accountId
create: valid, with content
update: label and content update
delete: cascades contents
```

#### 20. `IpReputationService` (`src/modules/ip-reputation/ip-reputation.service.ts`)

Dependencies to mock:
- `Repository<IpReputationDailyEntity>`
- `ClsService`
- `GoogleTasksProvider`

Key test cases:
```
sync: schedules Cloud Task, no duplicate
findAll: date range, accountId scope
```

#### 21. `VerifyService` (`src/modules/verify/verify.service.ts`)

Dependencies to mock:
- `Repository<VerifyStatisticsEntity>`
- `ClsService`

Key test cases:
```
findStatistics: by accountId, date range
processEmailValidation: valid email, invalid format
```

#### 22. `LeadStateService` (`src/modules/lead-state/lead-state.service.ts`)

Dependencies to mock:
- `GoogleDatastoreProvider`
- `ClsService`

Key test cases:
```
findLeadState: found in Datastore, not found
saveLeadState: upsert logic
deleteLeadState: cleanup
```

#### 23. `AuditsService` (`src/modules/audits/audits.service.ts`)

Dependencies to mock:
- `Repository<AuditEntity>`
- `ClsService`

Key test cases:
```
findAll: accountId scope, entity type filter
create: valid audit record
```

#### 24. `CampaignsRulesService` (`src/modules/campaigns-rules/campaigns-rules.service.ts`)

Dependencies to mock:
- `Repository<CampaignsRulesEntity>`
- `Repository<CampaignsRulesConfigsEntity>`
- `ClsService`

Key test cases:
```
findAll: accountId scope
create: valid with configs
evaluate: rule conditions (all/any), contact match
```

#### 25. `TestsService` (`src/modules/tests/tests.service.ts`)

Dependencies to mock:
- `HttpService` (from @nestjs/axios after upgrade, @nestjs/common before)
- `ClsService`

Key test cases:
```
glockapps: valid provider, unsupported provider
createTest: valid, duplicate
getResults: found, not found
```

#### 26. `StatisticsAggregationService` (`src/modules/statistics/statistics.aggregation.ts`)

Dependencies to mock:
- Redis client
- `Repository<EventStatisticsEntity>`

Key test cases:
```
aggregate: Redis set/get, TTL enforcement
removeOldData: Redis key scan and delete
```

#### 27. `AutomationMessageAccountService` — PARTIALLY COVERED

Expand existing spec:
- Add error branch for `findOneByMessageIdAndAccountId` when not found
- Add test for duplicate prevention logic if it exists

---

## Providers to Cover (12 providers)

#### 1. `PubSubProvider` (`src/providers/pubsub.providers.ts`)

```typescript
// Mock @google-cloud/pubsub:
jest.mock('@google-cloud/pubsub', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    topic: jest.fn().mockReturnValue({
      publishMessage: jest.fn().mockResolvedValue('msg-id-123'),
    }),
  })),
}));
```

Test cases:
- `sendAsyncMessage` in production mode: calls `publishMessage` with correct topic and JSON
- `sendAsyncMessage` in non-production: returns random hex without calling PubSub
- `sendAsyncMessageData` in production: calls with raw data buffer
- `sendAsyncMessage` when `publishMessage` rejects: propagates error

#### 2. `GoogleCloudStorageProvider` — PARTIALLY COVERED

Expand existing spec (currently unknown content):
- `upload`: mock `@google-cloud/storage` Bucket.file().save()
- `getSignedUrl`: mock file.getSignedUrl()
- `delete`: mock file.delete()
- `getPublicUrl`: verify URL format

#### 3. `GoogleBigqueryProvider` (`src/providers/google-bigquery.provider.ts`)

Mock `@google-cloud/bigquery` BigQuery class. Test cases:
- `query`: returns rows array, handles empty result
- `insert`: successful rows insertion, handles API error
- Constructor: verify dataset/table configuration from env vars

#### 4. `GoogleDatastoreProvider` (`src/providers/google-datastore.provider.ts`)

Mock `@google-cloud/datastore` Datastore class. Test cases:
- `get`: found, not found
- `save`: upsert with correct key
- `delete`: existing key

#### 5. `GoogleTasksProvider` (`src/providers/google-tasks.provider.ts`)

Mock `@google-cloud/tasks` CloudTasksClient. Test cases:
- `createTask`: valid payload, returns task name
- `deleteTask`: by task name
- Verify queue path construction from env vars

#### 6. `AccountConfigsProvider` (`src/providers/account-configs.provider.ts`)

Test cases:
- `getConfig`: config found, not found
- `mergeConfigs`: override precedence (account > default)

#### 7. `Auth0Provider` (`src/providers/auth0.provider.ts`)

Mock `auth0` ManagementClient. Test cases:
- `getUser`: found, not found
- `createUser`: valid
- `assignRoles`: valid
- Error from Auth0 API: propagation

#### 8. `ClickhouseProvider` (`src/providers/clickhouse.provider.ts`)

Mock `@clickhouse/client`. Test cases:
- `query`: returns ResultSet, handles empty
- `insert`: valid rows
- Connection constructor from env vars

#### 9. `OpenAIProvider` (`src/providers/openai.provider.ts`)

Mock `openai` OpenAI client. Test cases:
- `complete`: valid prompt, returns text
- Token limit handling
- API error propagation

#### 10. `ActiveCampaignProvider` (`src/providers/active-campaign.provider.ts`)

Mock `HttpService` (current: from @nestjs/common). Test cases:
- HTTP GET/POST with correct headers
- Error response handling

#### 11. `SlackProvider` (`src/providers/slack.provider.ts`)

Test cases:
- `sendMessage`: POST to webhook URL
- Error handling when webhook returns non-200

#### 12. `AccountConfigsProvider`

Covered above.

---

## Jest Configuration

Current `jest.config.ts` uses ts-jest 29. The coverage configuration should be set to:

```typescript
// jest.config.ts additions
coverageDirectory: 'coverage',
collectCoverageFrom: [
  'src/**/*.service.ts',
  'src/**/*.provider.ts',
  'src/**/*.handler.ts',
  '!src/**/*.module.ts',
  '!src/**/*.entity.ts',
  '!src/**/*.dto.ts',
  '!src/migrations/**',
  '!src/main.ts',
],
coverageThresholds: {
  global: {
    lines: 80,
    branches: 70,
    functions: 80,
    statements: 80,
  },
},
```

---

## Spec File Naming Convention

All new spec files follow the pattern established by existing specs:
- Located adjacent to the file under test: `src/modules/tags/tags.service.spec.ts`
- Named with `.spec.ts` suffix (Jest picks up by default config)
- One spec file per class

---

## Mocking Strategy for External SDKs

Use `jest.mock()` at the module level for GCP SDKs rather than injecting them through NestJS DI, since the providers construct SDK clients in their constructors:

```typescript
// At top of spec file, before imports
jest.mock('@google-cloud/pubsub');
jest.mock('@google-cloud/storage');
jest.mock('@google-cloud/bigquery');
jest.mock('@google-cloud/datastore');
jest.mock('@google-cloud/tasks');
jest.mock('@clickhouse/client');
```

For `nestjs-redis` (InjectRedis decorator), use the token directly:

```typescript
import { getRedisToken } from 'nestjs-redis';
// In providers array:
{ provide: getRedisToken('default'), useValue: mockRedis }
```

After the dependency upgrade to a direct ioredis provider, replace with the custom provider token.

---

## Test Execution Order

Within a single spec file, use `beforeEach` to reset all mocks:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

Use `afterAll` to close any async resources if needed:

```typescript
afterAll(async () => {
  await module.close();
});
```

---

## Coverage Verification Command

```bash
# Run after all spec files are written
yarn test:cov

# Check coverage report
open coverage/lcov-report/index.html
```

After the pnpm migration:
```bash
pnpm test:cov
```

---

## Estimated Effort

| Priority | Services/Providers | Estimated Spec Lines | Estimated Hours |
|---|---|---|---|
| P1 (Critical) | 5 services | ~1500 | 8h |
| P2 (Infrastructure) | 8 services + 4 providers | ~2000 | 10h |
| P3 (Supporting) | 14 services + 8 providers | ~2500 | 12h |
| **Total** | **35 files** | **~6000** | **~30h** |

Specs should be written bottom-up (pure utility services first, then services that compose them) to maximize mock reuse.
