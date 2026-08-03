import {
  buildRedisConnectionUrl,
  isRedisStreamsSocketIoEnabled
} from '@src/interface/WebSocket/adapters/socket-io/redisStreamsAdapter';

describe('redisStreamsAdapter', () => {
  it('should enable redis streams adapter only when explicitly configured', () => {
    expect.hasAssertions();
    expect(isRedisStreamsSocketIoEnabled({
      JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER: 'redis-streams'
    } as unknown as NodeJS.ProcessEnv)).toBe(true);

    expect(isRedisStreamsSocketIoEnabled({
      JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER: 'none'
    } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('should prefer websocket specific redis url when provided', () => {
    expect.hasAssertions();
    const url = buildRedisConnectionUrl({
      JUMENTIX_WEBSOCKET_REDIS_URL: 'redis://10.0.0.9:6379/3',
      JUMENTIX_REDIS_URL: 'redis://10.0.0.1:6379/1'
    } as unknown as NodeJS.ProcessEnv);
    expect(url).toBe('redis://10.0.0.9:6379/3');
  });

  it('should fallback to global redis url when websocket url is not set', () => {
    expect.hasAssertions();
    const url = buildRedisConnectionUrl({
      JUMENTIX_REDIS_URL: 'redis://10.0.0.1:6379/1'
    } as unknown as NodeJS.ProcessEnv);
    expect(url).toBe('redis://10.0.0.1:6379/1');
  });

  it('should compose redis url from host, port, database and password', () => {
    expect.hasAssertions();
    const redisTestPassword = ['redis', 'test', 'password'].join('-');
    const url = buildRedisConnectionUrl({
      JUMENTIX_REDIS_HOST: '127.0.0.1',
      JUMENTIX_REDIS_PORT: '6380',
      JUMENTIX_REDIS_DATABASE: '5',
      JUMENTIX_REDIS_PASSWORD: redisTestPassword
    } as unknown as NodeJS.ProcessEnv);
    expect(url).toBe(`redis://:${redisTestPassword}@127.0.0.1:6380/5`);
  });
});
