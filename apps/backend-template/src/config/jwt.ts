import { readProductEnv } from '@src/interface/runtime/RuntimeEnvironment';

const _JWT_TOKEN_SECRET_KEY_ = readProductEnv(process.env, 'JUMENTIX_JWT_TOKEN_SECRET_KEY');
const _JWT_TOKEN_EXPIRES_IN_ = 60 * 60; // one hour ( 60 * 60 )

export {
  _JWT_TOKEN_SECRET_KEY_,
  _JWT_TOKEN_EXPIRES_IN_
};
