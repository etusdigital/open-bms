# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`msgops-tracker` is a NestJS microservice within the MsgOps platform that handles contact lookups, short link redirects, and event tracking. It is packaged as a container (see project-level Docker setup) and exposes HTTP endpoints for:

- Contact retrieval by email, UUID, or hashed email
- Contact segment/tag queries for real-time personalization
- Short link redirection with event tracking
- Multi-account contact lookups

## Technology Stack

- **Framework**: NestJS 8.4.6
- **Database**: PostgreSQL via TypeORM 0.3.6
- **Cache**: Redis (via nestjs-redis)
- **Message Queue**: RabbitMQ (AMQP) via `@bms/messaging`
- **Rate Limiting**: Redis-backed throttler
- **Request Context**: nestjs-cls for request-scoped storage
- **Package Manager**: yarn
- **Runtime Port**: 3000 (default)

## Development Commands

```bash
# Install dependencies
yarn install

# Development mode with hot reload
yarn start:dev

# Build
yarn build

# Production mode
yarn start:prod

# Testing
yarn test              # Unit tests
yarn test:watch        # Watch mode
yarn test:cov          # Coverage report
yarn test:e2e          # E2E tests
yarn test:debug        # Debug mode

# Code quality
yarn lint              # ESLint with auto-fix
yarn format            # Prettier formatting
```

## Architecture

### Request Flow

The service uses a middleware chain for authentication and request context:

1. **ClsMiddleware**: Extracts `api-key` header into request-scoped storage
2. **AccountMiddleware**: Validates API key against `account_config` table and resolves `accountId`
3. Routes: Apply middlewares to paths: `/c`, `/bms/c`, `/cs`, `/bms/cs`, `/contacts`, `/bms/contacts`

Both `apiKey` and `accountId` are stored in `ClsService` and accessed via dependency injection:

```typescript
constructor(private readonly cls: ClsService) {}

const apiKey = this.cls.get('apiKey');
const accountId = this.cls.get('accountId');
```

### Core Components

- **AppController** (`src/app.controller.ts`): Main HTTP endpoints
  - `POST /c`, `/bms/c`: Contact lookup by email/uuid/hash (base64-encoded JSON body)
  - `POST /cs`, `/bms/cs`: Contact segments/tags query (base64-encoded JSON body)
  - `POST /ac`, `/bms/ac`: Multi-account contact lookup by email
  - `GET /contacts`, `/bms/contacts`: Contact details with optional includes (tags, segments, customFields)
  - `GET /redirect`: URL redirect with cookie setting for tracking
  - `GET /:shortCode`: Short link redirect with AMQP event publishing

- **MsgopsService** (`src/msgops/msgops.service.ts`): Business logic
  - Contact repository operations with TypeORM
  - Redis caching for account configs, short links, and real-time segments
  - Complex SQL queries with LATERAL joins for tags/segments/custom fields

- **AppService** (`src/app.service.ts`): Short link processing
  - Decodes short codes to long URLs via database + Redis cache
  - Publishes click events to AMQP exchange `bms.events` with routing-key `event.received.<platform>`
  - Sets tracking cookies on root domain

- **EventPublisherService** (`src/event-publisher.service.ts`): RabbitMQ publisher
  - Wraps `AmqpPublisher` from `@bms/messaging`
  - `sanitizePlatform()` allowlists platform header before deriving routing-key

### Database Entities

Located in `src/msgops/entities/`:

- **ContactEntity**: Core contact records (email, uuid, hashedEmail, firstName, lastName, phone)
- **ContactTagEntity**: Many-to-many contact-to-tag relationships
- **AccountConfigEntity**: Account configuration key-value pairs (includes API keys)
- **ShortLinkEntity**: URL shortening mappings
- **CustomFieldsEntity**: Custom field definitions
- **ContactCustomFieldsEntity**: Contact-to-custom-field values
- **AccountEntity**: Account information

### Rate Limiting

Configured via `ThrottlerModule` with Redis storage:

- Default: 10 requests per 10 seconds
- Scoped per IP address (with proxy support via `ThrottlerBehindProxyGuard`)
- Key prefix: `tracker-ratelimit:`

### Caching Strategy

Redis is used extensively for performance:

1. **Account Config**: 24-hour TTL, key: `accountConfig:{apiKey}`
2. **Short Links**: 24-hour TTL, key: `redirect_short_link:{shortCode}`
3. **Real-Time Segments**: Key: `real_time_segment:{accountId}` (no explicit TTL)

### Event Tracking

Short link clicks publish to AMQP exchange `bms.events` (routing-key `event.received.<platform>`) with this payload:

```json
{
  "categories": { ...urlParams },
  "payload": {
    "event": "click",
    "ip": "x.x.x.x",
    "url": "https://...",
    "headers": {...},
    "eventID": "uuid"
  }
}
```

Attributes: `platform`, `message_type`

## Environment Variables

Required variables (see `.env.local` for template):

```bash
# Database
TYPEORM_HOST
TYPEORM_PORT
TYPEORM_USERNAME
TYPEORM_PASSWORD
TYPEORM_DATABASE=msgops
TYPEORM_CONNECTION=postgres
TYPEORM_ENTITIES=dist/**/*.entity.js
TYPEORM_ENTITIES_DIR=dist/**/entities

# Redis
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD

# RabbitMQ
AMQP_URL                # AMQP broker URL (e.g. amqp://guest:guest@rabbitmq:5672)

# Runtime
PORT=3000
NODE_ENV=production
```

## Deployment

Provider-agnostic. The service is packaged as a container via the
repository-level Dockerfile and is intended to be operated via
`docker-compose.yml` for local/self-hosted use, or any container
orchestrator of choice (Kubernetes, Docker Swarm, Nomad, etc.).
Image base: Node.js LTS Alpine.

## API Request Patterns

### Contact Lookup (POST /c)

```json
{
  "data": "base64-encoded-json"
}
```

Decoded JSON must contain one of: `{ e: "email@example.com" }`, `{ h: "hashed" }`, `{ u: "uuid" }`

### Contact Segments (POST /cs)

```json
{
  "data": "base64-encoded-json"
}
```

Decoded JSON: `{ i: contactId }`

Returns array of tagIds that match real-time segments cached in Redis.

### Contact Details (GET /contacts)

Query params:

- `email`: Contact email (required)
- `includes`: Comma-separated options: `details`, `tags`, `segments`, `customFields`

Requires `account-id` header (set via middleware from API key).

## Key Implementation Details

### Multi-Account Lookup

The `accountsByEmail` method hardcodes a list of account IDs `[1, 5, 6, 10, 16, 19]` to search across specific accounts. This returns the "lo" (last opened) field for cross-account reporting.

### Base64 Encoding

Most POST endpoints expect base64-encoded JSON in the body's `data` field. This pattern is used for obfuscation of parameters in tracking pixels/scripts.

### Cookie Domain Logic

Root domain extraction logic handles both 3-level and 4-level domains:

```typescript
const domain = hostname.split('.');
const rootDomain = domain.slice(-(domain.length === 4 ? 3 : 2)).join('.');
```

### LATERAL Joins

Contact queries with `includes` options use PostgreSQL LATERAL joins for efficient aggregation of related data (tags, segments, custom fields) without N+1 queries.

## Testing

- **Unit tests**: Located in `src/`, co-located with source files as `*.spec.ts`
- **E2E tests**: Located in `test/`, use `jest-e2e.json` config
- **Coverage**: Output to `coverage/` directory

## Related Services

This service is part of the larger MsgOps platform and integrates with:

- **msgops-api**: Main API that manages contacts, campaigns, automations
- **msgops-event-process**: Consumes AMQP events published by this service via `@bms/messaging`
- **ClickHouse**: Click events flow to analytics tables (transport TBD — see EVO-1013)

## Security

- **Helmet**: Enabled for security headers
- **CORS**: Open to all origins (public tracking endpoints)
- **API Key Auth**: Required for contact lookup endpoints via middleware
- **Rate Limiting**: Redis-backed, IP-based throttling
