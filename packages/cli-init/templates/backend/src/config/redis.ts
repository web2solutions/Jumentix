import {
  RedisClientOptions, RedisFunctions, RedisScripts, RedisModules
} from 'redis';
import { readProductEnv } from '@src/interface/runtime/RuntimeEnvironment';

export const redisConfig = {
  host: readProductEnv(process.env, 'JUMENTIX_REDIS_HOST'),
  port: readProductEnv(process.env, 'JUMENTIX_REDIS_PORT'),
  database: readProductEnv(process.env, 'JUMENTIX_REDIS_DATABASE'),
  password: readProductEnv(process.env, 'JUMENTIX_REDIS_PASSWORD')
} as RedisClientOptions<RedisModules, RedisFunctions, RedisScripts>;
