describe('redisConfig', () => {
  const previous = {
    host: process.env.JUMENTIX_REDIS_HOST,
    port: process.env.JUMENTIX_REDIS_PORT,
    database: process.env.JUMENTIX_REDIS_DATABASE,
    password: process.env.JUMENTIX_REDIS_PASSWORD
  };

  const loadRedisConfig = () => {
    const resolved = require.resolve('@src/config/redis');
    delete require.cache[resolved];
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    return require('@src/config/redis').redisConfig;
  };

  afterEach(() => {
    process.env.JUMENTIX_REDIS_HOST = previous.host;
    process.env.JUMENTIX_REDIS_PORT = previous.port;
    process.env.JUMENTIX_REDIS_DATABASE = previous.database;
    process.env.JUMENTIX_REDIS_PASSWORD = previous.password;
    const resolved = require.resolve('@src/config/redis');
    delete require.cache[resolved];
  });

  it('reads the JUMENTIX_ redis env bindings', () => {
    expect.hasAssertions();
    process.env.JUMENTIX_REDIS_HOST = 'redis.example';
    process.env.JUMENTIX_REDIS_PORT = '6380';
    process.env.JUMENTIX_REDIS_DATABASE = '2';
    process.env.JUMENTIX_REDIS_PASSWORD = 'secret';

    expect(loadRedisConfig()).toMatchObject({
      host: 'redis.example',
      port: '6380',
      database: '2',
      password: 'secret'
    });
  });
});
