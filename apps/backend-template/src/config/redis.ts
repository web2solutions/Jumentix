import {
  RedisClientOptions, RedisFunctions, RedisScripts, RedisModules
} from 'redis';

export const redisConfig = {
  host: process.env.JUMENTIX_REDIS_HOST,
  port: process.env.JUMENTIX_REDIS_PORT,
  database: process.env.JUMENTIX_REDIS_DATABASE,
  password: process.env.JUMENTIX_REDIS_PASSWORD
} as RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>;
