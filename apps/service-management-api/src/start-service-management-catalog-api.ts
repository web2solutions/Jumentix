/* eslint-disable no-console */
import { compileAdapterRuntime } from '@jumentix/adapter-runtime-bootstrap';
import JwtService from '@src/infra/jwt/JwtService';
import compileMessageMediator from '@src/infra/messages/compileMessageMediator';
import MutexService from '@src/infra/mutex/adapter/MutexService';
import { compileDatabaseClient } from '@src/infra/persistence/compileDatabaseClient';
import compileKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/compileKeyValueStorageClient';
import PasswordCryptoService from '@src/infra/security/PasswordCryptoService';
import ExpressServer from '@src/interface/HTTP/adapters/express/ExpressServer';
import { composeUsersAuthServices } from '@src/modules/Users';

import { createServiceManagementCatalogDbClient } from '@service-management-api/infra/persistence/InMemoryDatabase/InMemoryCatalogDbClient';
import { applyCatalogCorsDefaults } from '@service-management-api/runtime/catalogCors';
import { ServiceManagementCatalogAPI } from '@service-management-api/ServiceManagementCatalogAPI';

import type { Express } from 'express';

applyCatalogCorsDefaults();

const webServer = new ExpressServer();

const {
  databaseClient: baseDatabaseClient,
  keyValueStorageClient,
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

const catalogAPI = new ServiceManagementCatalogAPI<Express>({
  databaseClient: createServiceManagementCatalogDbClient(baseDatabaseClient),
  webServer,
  authService,
  eventBus: messageMediator,
  messageMediator
});

(async () => {
  await catalogAPI.start();
  console.log('Service Management catalog API started.');
})().catch((error: unknown) => {
  console.error('Failed to start Service Management catalog API.', error);
  process.exitCode = 1;
});

const stop = async () => {
  await catalogAPI.stop();
  await keyValueStorageClient.disconnect?.();
};

process.once('SIGTERM', () => {
  stop()
    .catch((error: unknown) => {
      console.error('Failed to stop Service Management catalog API cleanly.', error);
    })
    .finally(() => {
      process.exitCode = 0;
    });
});
process.once('SIGINT', () => {
  stop()
    .catch((error: unknown) => {
      console.error('Failed to stop Service Management catalog API cleanly.', error);
    })
    .finally(() => {
      process.exitCode = 0;
    });
});
