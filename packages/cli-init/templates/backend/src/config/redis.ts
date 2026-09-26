import { readProductEnv } from '@src/interface/runtime/RuntimeEnvironment';

import type { RedisClientOptions } from 'redis';

const redisConfig = {
  host: readProductEnv(process.env, 'JUMENTIX_REDIS_HOST'),
  port: readProductEnv(process.env, 'JUMENTIX_REDIS_PORT'),
  database: readProductEnv(process.env, 'JUMENTIX_REDIS_DATABASE'),
  password: readProductEnv(process.env, 'JUMENTIX_REDIS_PASSWORD')
} as RedisClientOptions;

export default redisConfig;
