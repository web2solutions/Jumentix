import type IMutexService from '@src/infra/mutex/port/IMutexService';
import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';
import type { IPasswordCryptoService } from '@src/infra/security/IPasswordCryptoService';
import type { IMessageMediator } from '@src/modules/port';
import type { IAuthUseCases } from '@src/modules/Users/application/ports/IAuthUseCases';
import type { IOrganizationUseCases } from '@src/modules/Users/application/ports/IOrganizationUseCases';
import type { IUserUseCases } from '@src/modules/Users/application/ports/IUserUseCases';
import type { IAuthService } from '@src/modules/Users/service/ports/IAuthService';
import type UserService from '@src/modules/Users/service/UserService';
// import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';

export interface IControllerFactory {
  authService: IAuthService;
  openApiSpecification: any;
  databaseClient: IDatabaseClient;
  userService?: UserService;
  userUseCases?: IUserUseCases;
  organizationUseCases?: IOrganizationUseCases;
  authUseCases?: IAuthUseCases;
  passwordCryptoService?: IPasswordCryptoService;
  mutexService?: IMutexService;
  messageMediator?: IMessageMediator;
}
