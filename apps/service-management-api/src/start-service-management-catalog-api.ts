/* eslint-disable no-console */
import { Express } from 'express';
import { ExpressServer } from '@src/interface/HTTP/adapters/express/ExpressServer';
import { composeUsersAuthServices } from '@src/modules/Users';
import { MutexService } from '@src/infra/mutex/adapter/MutexService';
import { compileDatabaseClient } from '@src/infra/persistence/compileDatabaseClient';
import { JwtService } from '@src/infra/jwt/JwtService';
import { compileKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/compileKeyValueStorageClient';
import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import { compileMessageMediator } from '@src/infra/messages/compileMessageMediator';
import { compileAdapterRuntime } from '@jumentix/adapter-runtime-bootstrap';
import { ServiceManagementCatalogAPI } from '@service-management-api/ServiceManagementCatalogAPI';
import {
  createServiceManagementCatalogDbClient
} from '@service-management-api/infra/persistence/InMemoryDatabase/InMemoryCatalogDbClient';

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
})();

const stop = async () => {
  await catalogAPI.stop();
  await keyValueStorageClient.disconnect?.();
};

process.once('SIGTERM', () => {
  stop().finally(() => process.exit(0));
});
process.once('SIGINT', () => {
  stop().finally(() => process.exit(0));
});
