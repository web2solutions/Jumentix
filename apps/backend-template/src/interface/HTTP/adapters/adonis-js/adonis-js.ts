import { compileAdapterRuntime } from '@jumentix/adapter-runtime-bootstrap';

import JwtService from '@src/infra/jwt/JwtService';
import compileMessageMediator from '@src/infra/messages/compileMessageMediator';
import MutexService from '@src/infra/mutex/adapter/MutexService';
import { compileDatabaseClient } from '@src/infra/persistence/compileDatabaseClient';
import compileKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/compileKeyValueStorageClient';
import PasswordCryptoService from '@src/infra/security/PasswordCryptoService';
import { AdonisJsServer } from '@src/interface/HTTP/adapters/adonis-js/AdonisJsServer';
import infraHandlers from '@src/interface/HTTP/adapters/adonis-js/handlers/infraHandlers';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { composeUsersAuthServices } from '@src/modules/Users';

const serverType = EHTTPFrameworks.adonis_js;
const webServer = AdonisJsServer.compile();

const {
  databaseClient,
  keyValueStorageClient,
  mutexService,
  passwordCryptoService,
  messageMediator,
  authService
} = compileAdapterRuntime({
  compileDatabaseClient,
  compileKeyValueStorageClient,
  compileMutexService: (client) => MutexService.compile(client),
  compilePasswordCryptoService: () => PasswordCryptoService.compile(),
  compileJwtService: () => JwtService.compile(),
  compileMessageMediator: () => compileMessageMediator(),
  composeAuthServices: composeUsersAuthServices
});

const API = new RestAPI<any>({
  databaseClient,
  webServer,
  infraHandlers,
  serverType,
  authService,
  passwordCryptoService,
  keyValueStorageClient,
  mutexService,
  eventBus: messageMediator,
  messageMediator
});

// Bootstrap entrypoint: the process stays alive on the listening server, so
// startup is not awaited here; failures stay unhandled rejections, which the
// process-level handler registered by RestAPI logs and exits non-zero on.
(async () => {
  await API.start();
  await API.seedData();
})().catch((error: unknown) => {
  throw error;
});
