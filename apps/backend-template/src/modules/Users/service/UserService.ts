// file deepcode ignore WrongNumberOfArguments: <same name but different functions>
// file deepcode ignore MissingArgument: <same name but different functions>

import type {
  IPagingRequest,
  IPagingResponse,
  IServiceResponse,
  IServiceConfig,
  IEventBus
} from '@src/modules/port';
import {
  ServiceResponse,
  BaseService
} from '@src/modules/port';
import { UUID } from '@src/modules/port/UUID';

import type { IUser } from '@src/modules/Users/domain/Entity/IUser';
import { UserDataRepository } from '@src/modules/Users/adapters/out/persistence/UserDataRepository';
import { OrganizationDataRepository } from '@src/modules/Users/adapters/out/persistence/OrganizationDataRepository';
import { createUser } from '@src/modules/Users/features/createUser';
import { updateUser } from '@src/modules/Users/features/updateUser';
import { deleteUserById } from '@src/modules/Users/features/deleteUserById';
import { getUserById } from '@src/modules/Users/features/getUserById';
import { getAllUsers } from '@src/modules/Users/features/getAllUsers';
import { updatePassword } from '@src/modules/Users/features/updatePassword';
import { createDocument } from '@src/modules/Users/features/createDocument';
import { updateDocument } from '@src/modules/Users/features/updateDocument';
import { deleteDocument } from '@src/modules/Users/features/deleteDocument';
import { createPhone } from '@src/modules/Users/features/createPhone';
import { updatePhone } from '@src/modules/Users/features/updatePhone';
import { deletePhone } from '@src/modules/Users/features/deletePhone';
import { createEmail } from '@src/modules/Users/features/createEmail';
import { updateEmail } from '@src/modules/Users/features/updateEmail';
import { deleteEmail } from '@src/modules/Users/features/deleteEmail';
import type { RequestCreateUser } from '@src/modules/Users/interface/dto/RequestCreateUser';
import type { RequestUpdateUser } from '@src/modules/Users/interface/dto/RequestUpdateUser';
import type { RequestUpdatePassword } from '@src/modules/Users/interface/dto/RequestUpdatePassword';
import type { RequestCreateDocument } from '@src/modules/Users/interface/dto/RequestCreateDocument';
import type { RequestUpdateDocument } from '@src/modules/Users/interface/dto/RequestUpdateDocument';
import type { RequestCreatePhone } from '@src/modules/Users/interface/dto/RequestCreatePhone';
import type { RequestUpdatePhone } from '@src/modules/Users/interface/dto/RequestUpdatePhone';
import type { RequestCreateEmail } from '@src/modules/Users/interface/dto/RequestCreateEmail';
import type { RequestUpdateEmail } from '@src/modules/Users/interface/dto/RequestUpdateEmail';
import { UserIntegrationEventName } from '@src/modules/Users/events/contracts/UserIntegrationEventName';

import { canNotBeEmpty, mustBePassword } from '@src/shared/validators';

import type { IMutexService } from '@src/infra/mutex/port/IMutexService';
import type { IPasswordCryptoService } from '@src/infra/security/IPasswordCryptoService';

import { BaseError, ResourceLockedError } from '@src/infra/exceptions';
import { shouldRequireOrganization } from '@src/modules/Users/domain/security/Rbac';
import type { ICacheService } from '@src/infra/cache';
import type { IDeadLetterQueue } from '@jumentix/dead-letter-queue';

interface IUserServiceConfig extends IServiceConfig {
  organizationDataRepository?: OrganizationDataRepository;
}

export class UserService extends BaseService<IUser, RequestCreateUser, RequestUpdateUser> {
  public dataRepository: UserDataRepository;

  public organizationDataRepository?: OrganizationDataRepository;

  private readonly entityName = 'User';

  private readonly mutexService: IMutexService;

  private readonly passwordCryptoService: IPasswordCryptoService;

  private readonly eventBus?: IEventBus;

  private readonly cacheService?: ICacheService;

  /**
   * JUM-53 — where writes refused by the mutex go.
   *
   * Optional: without it the service behaves exactly as before, throwing and
   * discarding the transaction. Wiring it in is what stops a write lost to
   * contention from being indistinguishable from one never attempted.
   */
  private readonly deadLetterQueue?: IDeadLetterQueue;

  public constructor(
    config: IUserServiceConfig
  ) {
    super(config);
    const { dataRepository, services } = config;
    this.dataRepository = dataRepository as UserDataRepository;
    this.organizationDataRepository = (
      config.organizationDataRepository as OrganizationDataRepository | undefined
    );
    this.passwordCryptoService = services!.passwordCryptoService;
    // this.services.mutexService = services!.mutexService;
    this.mutexService = services!.mutexService;
    this.eventBus = services?.eventBus as IEventBus | undefined;
    this.cacheService = services?.cacheService as ICacheService | undefined;
    this.deadLetterQueue = services?.deadLetterQueue as IDeadLetterQueue | undefined;
  }

  /**
   * Record the refused write, then refuse it.
   *
   * The order is the whole point. The caller still receives
   * `ResourceLockedError`, because the write has **not** happened — a client
   * told otherwise would act on a lie. The queue only makes the attempt
   * recoverable.
   *
   * A queue failure must not change the error the caller sees either: it is
   * swallowed here, because "the resource is locked" remains the true answer
   * whether or not the record was stored. Losing the record is bad; reporting
   * a Redis outage to a user who hit contention is worse and hides the cause.
   */
  private async rejectLocked(operation: string, id: string, payload: unknown): Promise<never> {
    if (this.deadLetterQueue) {
      try {
        await this.deadLetterQueue.enqueue({
          entityName: this.entityName, resourceId: id, operation, payload
        });
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('[dead-letter] failed to record a locked write', {
          entityName: this.entityName, resourceId: id, operation, error
        });
      }
    }
    throw new ResourceLockedError(`${this.entityName} ${id} is locked`);
  }

  private static sortPayload(payload: any): any {
    if (Array.isArray(payload)) {
      return payload.map((item) => UserService.sortPayload(item));
    }
    if (!payload || typeof payload !== 'object') {
      return payload;
    }
    return Object.keys(payload)
      .sort()
      .reduce((acc, key) => {
        acc[key] = UserService.sortPayload(payload[key]);
        return acc;
      }, {} as Record<string, any>);
  }

  private async getCacheVersion(): Promise<number> {
    if (!this.cacheService) return 1;
    return this.cacheService.getVersion('users');
  }

  private async invalidateReadCache(): Promise<void> {
    if (!this.cacheService) return;
    await this.cacheService.bumpVersion('users');
  }

  private static sanitizeUser(user?: IUser): IUser | undefined {
    if (!user) return undefined;
    const safeUser = { ...(user as IUser & { salt?: string }) };
    delete (safeUser as any).password;
    delete (safeUser as any).salt;
    return safeUser as IUser;
  }

  private static sanitizeUsers(users?: IUser[]): IUser[] {
    return (users || []).map((user) => UserService.sanitizeUser(user) as IUser);
  }

  private async ensureOrganizationCompliance(
    data: { organization?: string; roles?: string[] }
  ): Promise<void> {
    const roles = data.roles || [];
    const organization = data.organization || '';
    if (shouldRequireOrganization(roles) && !organization) {
      throw new Error('organization is required for admin and user roles');
    }
    if (!organization) return;
    if (!this.organizationDataRepository) return;
    await this.organizationDataRepository.getOneById(organization);
  }

  private async syncOrganizationUsers(
    userId: string,
    previousOrganizationId: string = '',
    nextOrganizationId: string = ''
  ): Promise<void> {
    if (!this.organizationDataRepository) return;
    let relationshipChanged = false;

    if (previousOrganizationId && previousOrganizationId !== nextOrganizationId) {
      const previous = await this.organizationDataRepository.getOneById(previousOrganizationId);
      const nextUsers = previous.users.filter((id: string) => id !== userId);
      await this.organizationDataRepository.update(previousOrganizationId, {
        id: previous.id,
        name: previous.name,
        address: previous.address,
        phone: previous.phone,
        email: previous.email,
        users: nextUsers
      });
      relationshipChanged = true;
    }

    if (nextOrganizationId) {
      const organization = await this.organizationDataRepository.getOneById(nextOrganizationId);
      const linkedUsers = [...new Set([...(organization.users || []), userId])];
      await this.organizationDataRepository.update(nextOrganizationId, {
        id: organization.id,
        name: organization.name,
        address: organization.address,
        phone: organization.phone,
        email: organization.email,
        users: linkedUsers
      });
      relationshipChanged = true;
    }

    if (relationshipChanged && this.cacheService) {
      await this.cacheService.bumpVersion('organizations');
    }
  }

  private async publishEvent(name: string, payload: Record<string, any>): Promise<void> {
    if (!this.eventBus?.publish) return;
    try {
      await this.eventBus.publish({
        name,
        payload,
        occurredAt: new Date().toISOString()
      });
    } catch (error) {
      // Do not break primary flow because of async integration side-effects.
    }
  }

  public async getOneByUsernameForAuth(username: string): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const result: IPagingResponse<IUser[]> = await getAllUsers(
        { username },
        { page: 1, size: 1 },
        this.dataRepository
      );
      const [userFound] = result.result;
      serviceResponse.result = userFound;
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async create(data: RequestCreateUser): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const password = data.password || '';
      mustBePassword('password', password);
      await this.ensureOrganizationCompliance({
        organization: data.organization,
        roles: data.roles
      });

      const newData = { ...data };
      const { hash, salt } = await this.passwordCryptoService.hash(password);
      newData.password = hash;
      newData.salt = salt;

      const createdUser = await createUser((newData ?? {}), this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(createdUser);
      await this.invalidateReadCache();
      await this.syncOrganizationUsers(createdUser.id, '', createdUser.organization || '');
      await this.publishEvent(UserIntegrationEventName.Created, { id: serviceResponse.result?.id });
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  // eslint-disable-next-line class-methods-use-this
  public async update(id: string, data: RequestUpdateUser): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      UUID.parse(id);
      const previous = await this.dataRepository.getOneById(id);
      await this.ensureOrganizationCompliance({
        organization: data.organization ?? previous.organization,
        roles: data.roles ?? previous.roles
      });
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('update', id, data);
      // console.log('data', data);
      const user = await updateUser(id, data, this.dataRepository);
      // console.log('user', user)
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();
      await this.syncOrganizationUsers(
        id,
        previous.organization || '',
        user.organization || ''
      );
      await this.publishEvent(UserIntegrationEventName.Updated, { id });

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;
      // console.log(error);
      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async delete(id: string): Promise<IServiceResponse<boolean>> {
    const serviceResponse: IServiceResponse<boolean> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('delete', id, {});
      const previous = await this.dataRepository.getOneById(id);
      const deleted = await deleteUserById(id, this.dataRepository);
      serviceResponse.result = deleted;
      await this.invalidateReadCache();
      await this.syncOrganizationUsers(id, previous.organization || '', '');
      await this.publishEvent(UserIntegrationEventName.Deleted, { id });

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async getOneById(id: string): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const version = await this.getCacheVersion();
      const cacheKey = `users:v${version}:getOneById:${id}`;
      const cached = await this.cacheService?.get<IUser>(cacheKey);
      if (cached) {
        serviceResponse.result = cached;
        return serviceResponse;
      }

      const user = await getUserById(id, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      if (serviceResponse.result) {
        await this.cacheService?.set(cacheKey, serviceResponse.result);
      }
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async getAll(
    filters: Record<string, string|number>,
    paging: IPagingRequest
  ): Promise<IServiceResponse<IUser[]>> {
    let serviceResponse: IServiceResponse<IUser[]> = {};
    try {
      const version = await this.getCacheVersion();
      const cacheKey = `users:v${version}:getAll:${JSON.stringify(UserService.sortPayload({
        filters,
        paging
      }))}`;
      const cached = await this.cacheService?.get<IServiceResponse<IUser[]>>(cacheKey);
      if (cached) {
        return cached;
      }

      const result: IPagingResponse<IUser[]> = await getAllUsers(
        filters,
        paging,
        this.dataRepository
      );
      serviceResponse = {
        ...result,
        result: UserService.sanitizeUsers(result.result)
      };
      await this.cacheService?.set(cacheKey, serviceResponse);
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async updatePassword(
    id: string,
    data: RequestUpdatePassword
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      canNotBeEmpty('password', data.password);
      mustBePassword('password', data.password);

      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('updatePassword', id, data);

      const newData = { ...data };
      const { hash, salt } = await this.passwordCryptoService.hash(data.password);
      newData.password = hash;
      newData.salt = salt;
      const user = await updatePassword(id, newData, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();
      await this.publishEvent(UserIntegrationEventName.CredentialChanged, { id });

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return new ServiceResponse(serviceResponse);
  }

  public async createDocument(
    id: string,
    data: RequestCreateDocument
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('createDocument', id, data);

      const user = await createDocument(id, data, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;
      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async updateDocument(
    id: string,
    documentId: string,
    data: RequestUpdateDocument
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('updateDocument', id, { documentId, data });

      const user = await updateDocument(id, documentId, data, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async deleteDocument(
    id: string,
    documentId: string
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('deleteDocument', id, { documentId });

      const user = await deleteDocument(id, documentId, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async createPhone(
    id: string,
    data: RequestCreatePhone
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('createPhone', id, data);

      const user = await createPhone(id, data, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async updatePhone(
    id: string,
    phoneId: string,
    data: RequestUpdatePhone
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('updatePhone', id, { phoneId, data });

      const user = await updatePhone(id, phoneId, data, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async deletePhone(
    id: string,
    phoneId: string
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('deletePhone', id, { phoneId });

      const user = await deletePhone(id, phoneId, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async createEmail(
    id: string,
    data: RequestCreateEmail
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('createEmail', id, data);

      const user = await createEmail(id, data, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async updateEmail(
    id: string,
    emailId: string,
    data: RequestUpdateEmail
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('updateEmail', id, { emailId, data });

      const user = await updateEmail(id, emailId, data, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public async deleteEmail(
    id: string,
    emailId: string
  ): Promise<IServiceResponse<IUser>> {
    const serviceResponse: IServiceResponse<IUser> = {};
    try {
      const { result: { previouslyLocked } } = await this.mutexService.lock(this.entityName, id);
      if (previouslyLocked) await this.rejectLocked('deleteEmail', id, { emailId });

      const user = await deleteEmail(id, emailId, this.dataRepository);
      serviceResponse.result = UserService.sanitizeUser(user);
      await this.invalidateReadCache();

      await this.mutexService.unlock(this.entityName, id);
    } catch (error) {
      serviceResponse.error = error as BaseError;

      await this.mutexService.unlock(this.entityName, id);
    }
    return serviceResponse;
  }

  public static compile(config: IUserServiceConfig): UserService {
    return new UserService(config);
  }
}
