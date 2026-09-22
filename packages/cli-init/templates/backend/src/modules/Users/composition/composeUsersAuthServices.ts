import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IPasswordCryptoService } from '@src/infra/security/IPasswordCryptoService';
import type { IMutexService } from '@src/infra/mutex/port/IMutexService';
import type { IJwtService } from '@src/infra/jwt/IJwtService';
import type { IKeyValueStorageClient } from '@src/infra/persistence/KeyValueStorage/IKeyValueStorageClient';
import type { IEventBus, IMessageMediator } from '@src/modules/port';
import { InMemorySecurityAuditRepository } from '@src/infra/audit';
import { CacheService } from '@src/infra/cache';

import { UserDataRepository } from '@src/modules/Users/adapters/out/persistence/UserDataRepository';
import { OrganizationDataRepository } from '@src/modules/Users/adapters/out/persistence/OrganizationDataRepository';
import { UserService } from '@src/modules/Users/service/UserService';
import { OrganizationService } from '@src/modules/Users/service/OrganizationService';
import { UserProviderLocal } from '@src/modules/Users/service/UserProviderLocal';
import { AuthService } from '@src/modules/Users/service/AuthService';
import { UserUseCases } from '@src/modules/Users/application/use-cases/UserUseCases';
import { OrganizationUseCases } from '@src/modules/Users/application/use-cases/OrganizationUseCases';
import { AuthUseCases } from '@src/modules/Users/application/use-cases/AuthUseCases';
import type { IUserUseCases } from '@src/modules/Users/application/ports/IUserUseCases';
import type { IOrganizationUseCases } from '@src/modules/Users/application/ports/IOrganizationUseCases';
import type { IAuthUseCases } from '@src/modules/Users/application/ports/IAuthUseCases';
import type { IUserEventListeners } from '@src/modules/Users/events/contracts/IUserEventListeners';
import { registerUserEventListeners } from '@src/modules/Users/events/listeners/registerUserEventListeners';
import { registerUserMessageHandlers } from '@src/modules/Users/events/listeners/registerUserMessageHandlers';
import type { IUserProvider } from '@src/modules/Users/service/ports/IUserProvider';
import type { IAuthService } from '@src/modules/Users/service/ports/IAuthService';
import type { DeadLetterQueue, DeadLetterReplayWorker } from '@jumentix/dead-letter-queue';
import {
  composeUserDeadLetterQueue,
  composeUserDeadLetterWorker
} from '@src/modules/Users/composition/composeUserDeadLetterReplay';

interface IUsersAuthCompositionConfig {
  databaseClient: IDatabaseClient;
  passwordCryptoService: IPasswordCryptoService;
  mutexService: IMutexService;
  jwtService: IJwtService;
  keyValueStorageClient?: IKeyValueStorageClient;
  eventBus?: IEventBus;
  messageMediator?: IMessageMediator;
  userEventListeners?: IUserEventListeners;
  deadLetterIntervalMs?: number;
}

interface IUsersAuthComposition {
  dataRepository: UserDataRepository;
  organizationDataRepository: OrganizationDataRepository;
  userService: UserService;
  organizationService: OrganizationService;
  userProvider: IUserProvider;
  authService: IAuthService;
  userUseCases: IUserUseCases;
  organizationUseCases: IOrganizationUseCases;
  authUseCases: IAuthUseCases;
  deadLetterQueue?: DeadLetterQueue;
  deadLetterWorker?: DeadLetterReplayWorker;
}

export const composeUsersAuthServices = (
  config: IUsersAuthCompositionConfig
): IUsersAuthComposition => {
  const {
    databaseClient,
    passwordCryptoService,
    mutexService,
    jwtService,
    keyValueStorageClient,
    eventBus,
    messageMediator,
    userEventListeners,
    deadLetterIntervalMs
  } = config;
  const integrationBus = messageMediator ?? eventBus;
  const cacheService = keyValueStorageClient
    ? CacheService.compile({ keyValueStorageClient })
    : undefined;

  const dataRepository = UserDataRepository.compile({
    databaseClient
  });
  const organizationDataRepository = OrganizationDataRepository.compile({
    databaseClient
  });
  // JUM-53. Built before the service because the service takes it, and only
  // when there is a shared store: a process-local queue would be lost on
  // restart while looking like durability.
  const deadLetterQueue = composeUserDeadLetterQueue(keyValueStorageClient);
  const userService = UserService.compile({
    dataRepository,
    organizationDataRepository,
    services: {
      passwordCryptoService,
      mutexService,
      eventBus: integrationBus,
      cacheService,
      deadLetterQueue
    }
  });
  // Returned rather than started here. Composition builds; a background timer
  // is the runtime's to start and, more importantly, to stop.
  const deadLetterWorker = composeUserDeadLetterWorker(
    deadLetterQueue,
    userService,
    deadLetterIntervalMs
  );
  const organizationService = OrganizationService.compile({
    dataRepository: organizationDataRepository,
    services: {
      cacheService
    }
  });
  const userProvider = UserProviderLocal.compile(userService);
  const authService = AuthService.compile(
    userProvider,
    passwordCryptoService,
    jwtService,
    keyValueStorageClient,
    integrationBus,
    InMemorySecurityAuditRepository.compile()
  );
  const userUseCases = UserUseCases.compile(userService);
  const organizationUseCases = OrganizationUseCases.compile(organizationService);
  const authUseCases = AuthUseCases.compile(authService, mutexService);

  if (integrationBus) {
    registerUserEventListeners(integrationBus, userEventListeners);
  }
  if (messageMediator) {
    registerUserMessageHandlers(messageMediator, authService);
  }

  return {
    dataRepository,
    organizationDataRepository,
    userService,
    organizationService,
    userProvider,
    authService,
    userUseCases,
    organizationUseCases,
    authUseCases,
    deadLetterQueue,
    deadLetterWorker
  };
};
