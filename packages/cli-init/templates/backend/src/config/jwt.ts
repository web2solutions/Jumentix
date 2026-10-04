import { readProductEnv } from '@src/interface/runtime/RuntimeEnvironment';

const JWT_TOKEN_SECRET_KEY = readProductEnv(process.env, 'JUMENTIX_JWT_TOKEN_SECRET_KEY');
const JWT_TOKEN_EXPIRES_IN = 60 * 60; // one hour ( 60 * 60 )

export { JWT_TOKEN_EXPIRES_IN, JWT_TOKEN_SECRET_KEY };

// Legacy underscored aliases kept for consumers outside this app
// (service-management-api, cli-init templates) that still import them.
export {
  JWT_TOKEN_EXPIRES_IN as _JWT_TOKEN_EXPIRES_IN_,
  JWT_TOKEN_SECRET_KEY as _JWT_TOKEN_SECRET_KEY_
};
