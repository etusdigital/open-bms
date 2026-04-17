# Message Operations Event Processing Service

A high-performance NestJS application designed to process and store message-related events in real-time. This service efficiently handles millions of events daily, providing a robust backbone for email analytics, user engagement tracking, and message delivery monitoring.

## Features

- **High-performance Event Processing**: Optimized to handle millions of daily events with low latency
- **Timestamp Validation**: Protects against incorrect device times by enforcing a 12-hour timestamp validity window
- **Multi-level Caching**: Uses both in-memory and Redis caching for optimal performance
- **Email Provider Detection**: Automatically identifies email service providers (Gmail, Yahoo, Microsoft, etc.)
- **Bot Detection**: Filters out bot/crawler activity to ensure accurate engagement metrics
- **Timezone Management**: Supports converting timestamps across different timezones
- **Scalable Architecture**: Built on NestJS framework with a modular design for easy scaling

## Architecture

The application follows a modular NestJS architecture:

- **Events Module**: Handles processing and validation of events from various sources
- **MsgOps Module**: Core message operations functionality including database interactions
- **Utils**: Shared utilities for formatting, validation, and data transformation
- **Providers**: Database and external service connections

### Key Components

- **FormatterUtils**: Handles data formatting, timestamp normalization, and validation logic
- **CacheService**: Provides efficient multi-level caching to improve performance
- **MsgopsService**: Core service for database operations and event processing

## Prerequisites

- Node.js (v20.16.0 recommended, managed via Volta)
- PostgreSQL database (for storing contacts and events)
- Redis (for caching)
- Docker and Docker Compose (for containerized deployment)

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd msgops-event-process
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Configuration

The application is configured via environment variables in the `.env` file:

- `PORT`: The port the application will listen on (default: 3000)
- `HOST`: The host the application will bind to (default: 0.0.0.0)
- `PG_*`: PostgreSQL connection settings
- `REDIS_*`: Redis connection settings
- `LOG_LEVEL`: Logging level configuration (DEBUG, INFO, etc.)

## Running the Application

### Development Mode

```bash
# Start in development mode with auto-reload
npm run start:dev

# Start in debug mode
npm run start:debug
```

### Production Mode

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

### Using Docker

```bash
# Build and start using Docker Compose
docker-compose up -d
```

## Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:cov

# Run end-to-end tests
npm run test:e2e
```

## Performance Considerations

The service is designed to handle high volumes of events with minimal latency:

- **Caching Strategy**: Uses a two-level caching approach (in-memory + Redis) to minimize database queries
- **Efficient Data Processing**: Optimized functions for timestamp handling and data formatting
- **Connection Pooling**: Database connections are pooled for optimal resource utilization
- **Validation Rules**: Timestamp validation ensures data integrity even with device clock errors

## API Documentation

The service exposes a RESTful API for event processing. Main endpoints:

- `POST /events`: Process new events
- `GET /health`: Service health check

For detailed API documentation, run the application and visit `/api/docs`.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary and confidential.
