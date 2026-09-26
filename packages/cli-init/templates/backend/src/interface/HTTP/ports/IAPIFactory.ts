import type IMutexService from '@src/infra/mutex/port/IMutexService';
import type IKeyValueStorageClient from '@src/infra/persistence/KeyValueStorage/IKeyValueStorageClient';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IPasswordCryptoService } from '@src/infra/security/IPasswordCryptoService';
import type { EHTTPFrameworks, EndPointFactory, IHTTPServer } from '@src/interface/HTTP/ports';
// import { IMutexService } from '@src/domains/ports/mutex/IMutexService';
import type { IEventBus, IMessageMediator } from '@src/modules/port';
import type { IAuthService } from '@src/modules/Users/service/ports/IAuthService';

export interface IAPIFactory<ServerType> {
  databaseClient: IDatabaseClient;
  webServer: IHTTPServer<ServerType>;
  serverType?: EHTTPFrameworks;
  mutexService?: IMutexService;
  infraHandlers: Record<string, EndPointFactory>;
  authService?: IAuthService;
  passwordCryptoService?: IPasswordCryptoService;
  keyValueStorageClient?: IKeyValueStorageClient;
  eventBus?: IEventBus;
  messageMediator?: IMessageMediator;
}
