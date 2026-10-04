import { compileAdapterRuntime } from '@jumentix/adapter-runtime-bootstrap';

import JwtService from '@src/infra/jwt/JwtService';
import compileMessageMediator from '@src/infra/messages/compileMessageMediator';
import MutexService from '@src/infra/mutex/adapter/MutexService';
import { compileDatabaseClient } from '@src/infra/persistence/compileDatabaseClient';
import compileKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/compileKeyValueStorageClient';
import PasswordCryptoService from '@src/infra/security/PasswordCryptoService';
import ExpressServer from '@src/interface/HTTP/adapters/express/ExpressServer';
import infraHandlers from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { EHTTPFrameworks } from '@src/interface/HTTP/ports';
import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { composeUsersAuthServices } from '@src/modules/Users';

import type { Express } from 'express';

const serverType = EHTTPFrameworks.express;
const webServer = ExpressServer.compile();

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

const API = new RestAPI<Express>({
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

(async () => {
  await API.start();
  await API.seedData();
})().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
