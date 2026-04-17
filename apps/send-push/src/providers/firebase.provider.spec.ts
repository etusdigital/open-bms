import * as admin from 'firebase-admin';
import { FirebaseProvider } from './firebase.provider';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  app: jest.fn(),
  credential: {
    cert: jest.fn().mockReturnValue({}),
  },
  messaging: jest.fn(),
}));

describe('FirebaseProvider', () => {
  const originalEnv = process.env.NODE_ENV;

  let initializeAppMock: jest.Mock;
  let appMock: jest.Mock;
  let messagingMock: jest.Mock;
  let sendEachMock: jest.Mock;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';

    initializeAppMock = admin.initializeApp as unknown as jest.Mock;
    appMock = admin.app as unknown as jest.Mock;
    messagingMock = admin.messaging as unknown as jest.Mock;

    initializeAppMock.mockReset();
    appMock.mockReset();
    messagingMock.mockReset();

    sendEachMock = jest.fn();
    messagingMock.mockReturnValue({ sendEach: sendEachMock });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('should return early in constructor when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    const provider = new FirebaseProvider({ breakArrayInChunks: jest.fn() } as never);

    expect(provider).toBeInstanceOf(FirebaseProvider);
  });

  it('should initialize app only once for the same firebaseApp', async () => {
    initializeAppMock.mockReturnValue({ name: 'default' });
    const utils = { breakArrayInChunks: jest.fn() };
    const provider = new FirebaseProvider(utils as never);

    await provider.initializeApp('{}', 'default');
    await provider.initializeApp('{}', 'default');

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(messagingMock).toHaveBeenCalledTimes(1);
  });

  it('should fallback to admin.app when initializeApp throws', async () => {
    initializeAppMock.mockImplementation(() => {
      throw new Error('already exists');
    });
    appMock.mockReturnValue({ name: 'default' });

    const utils = { breakArrayInChunks: jest.fn() };
    const provider = new FirebaseProvider(utils as never);

    await provider.initializeApp('{}', 'default');

    expect(appMock).toHaveBeenCalledWith('default');
    expect(messagingMock).toHaveBeenCalledTimes(1);
  });

  it('should batch messages and aggregate responses', async () => {
    initializeAppMock.mockReturnValue({ name: 'app-1' });

    const msg1 = { token: '1' };
    const msg2 = { token: '2' };
    const msg3 = { token: '3' };

    const utils = {
      breakArrayInChunks: jest.fn().mockReturnValue([[msg1, msg2], [msg3]]),
    };

    sendEachMock
      .mockResolvedValueOnce({ responses: [{ success: true }], successCount: 1, failureCount: 0 })
      .mockResolvedValueOnce({ responses: [{ success: false }], successCount: 0, failureCount: 1 });

    const provider = new FirebaseProvider(utils as never);

    const result = await provider.sendFirebaseMessages([msg1, msg2, msg3] as never, '{}', 'app-1');

    expect(utils.breakArrayInChunks).toHaveBeenCalledWith([msg1, msg2, msg3], 500);
    expect(sendEachMock).toHaveBeenCalledTimes(2);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.responses).toHaveLength(2);
  });

  it('should log messages in non-production environment', async () => {
    process.env.NODE_ENV = 'development';
    initializeAppMock.mockReturnValue({ name: 'log-app' });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const msg = { token: 'tok-1', notification: { title: 'Hi', body: 'Hello' } };
    const utils = {
      breakArrayInChunks: jest.fn().mockReturnValue([[msg]]),
    };

    sendEachMock.mockResolvedValueOnce({ responses: [], successCount: 1, failureCount: 0 });

    const provider = new FirebaseProvider(utils as never);
    await provider.sendFirebaseMessages([msg] as never, '{}', 'log-app');

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should support dryRun parameter', async () => {
    initializeAppMock.mockReturnValue({ name: 'dry-app' });

    const msg = { token: 'tok-1' };
    const utils = {
      breakArrayInChunks: jest.fn().mockReturnValue([[msg]]),
    };

    sendEachMock.mockResolvedValueOnce({ responses: [], successCount: 1, failureCount: 0 });

    const provider = new FirebaseProvider(utils as never);
    await provider.sendFirebaseMessages([msg] as never, '{}', 'dry-app', true);

    expect(sendEachMock).toHaveBeenCalledWith([msg], true);
  });
});
