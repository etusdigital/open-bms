/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/integration/**/*.integration.spec.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 60_000,
  // amqplib emits "Socket closed abruptly during opening handshake" on the
  // process when a socket close races with testcontainers stopping the
  // broker. setupFiles installs a filter BEFORE Jest's own handlers so the
  // known benign event doesn't flip the suite result. forceExit prevents
  // any remaining async handles from hanging the process.
  forceExit: true,
};
