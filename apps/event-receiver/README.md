# Event Receiver Service

A NestJS-based service that receives and processes various types of events, forwarding them to Google Cloud Pub/Sub for further processing.

## Features

- Handles multiple content types:
  - JSON
  - Form URL-encoded
  - Text/plain (JSON)
- Processes custom events with type, event, and properties
- Supports Twilio event processing
- Client information tracking (IP, User Agent)
- Environment-based behavior (development vs production)

## Prerequisites

- Node.js (v20 or higher)
- Google Cloud Platform account with Pub/Sub enabled
- Service account credentials with Pub/Sub permissions

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
NODE_ENV=development
TOPIC_NAME_EVENT_PROCESS=your-topic-name
SERVICE_ACCOUNT={"type": "service_account", ...} # Your GCP service account JSON
```

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Running the Service

```bash
# Development mode
pnpm run start:dev

# Production mode
pnpm run start:prod
```

## API Endpoints

### POST /events

Receives events in various formats and forwards them to Pub/Sub.

#### Supported Content Types:

- `application/json`
- `application/x-www-form-urlencoded`
- `text/plain`

#### Example Requests:

1. JSON Event:

```json
{
  "type": "test",
  "event": "click",
  "properties": {
    "button": "submit"
  }
}
```

2. Form URL-encoded:

```
type=test&event=submit&value=123
```

3. Text/plain (JSON):

```json
{
  "type": "test",
  "event": "plain_text",
  "properties": {
    "source": "text"
  }
}
```

## Testing

```bash
# Unit tests
pnpm run test

# Test coverage
pnpm run test:cov
```

## Development

The project uses:

- NestJS framework
- Fastify as the HTTP server
- Google Cloud Pub/Sub for message processing
- Jest for testing

## Project Structure

```
src/
├── app.controller.ts    # HTTP request handling
├── app.service.ts       # Business logic
├── app.module.ts       # Application configuration
├── pubsub.service.ts   # Google Cloud Pub/Sub integration
└── main.ts            # Application entry point
```

## Error Handling

The service handles various error cases:

- Invalid JSON in text/plain content
- Empty request bodies
- Custom event processing errors
- Pub/Sub publishing errors

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License.
