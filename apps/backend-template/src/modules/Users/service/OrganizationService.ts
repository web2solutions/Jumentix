import {
  BaseService,
  IServiceConfig,
  IServiceResponse,
  IPagingRequest
} from '@src/modules/port';
import { BaseError } from '@src/infra/exceptions';
import { IOrganization } from '@src/modules/Users/domain/Entity/IOrganization';
import { RequestCreateAddress } from '@src/modules/Users/interface/dto/RequestCreateAddress';
import { RequestCreateEmail } from '@src/modules/Users/interface/dto/RequestCreateEmail';
import { RequestCreateOrganization } from '@src/modules/Users/interface/dto/RequestCreateOrganization';
import { RequestCreatePhone } from '@src/modules/Users/interface/dto/RequestCreatePhone';
import { RequestUpdateAddress } from '@src/modules/Users/interface/dto/RequestUpdateAddress';
import { RequestUpdateEmail } from '@src/modules/Users/interface/dto/RequestUpdateEmail';
import { RequestUpdateOrganization } from '@src/modules/Users/interface/dto/RequestUpdateOrganization';
import { RequestUpdatePhone } from '@src/modules/Users/interface/dto/RequestUpdatePhone';
import { OrganizationDataRepository } from '@src/modules/Users/adapters/out/persistence/OrganizationDataRepository';
import { ICacheService } from '@src/infra/cache';

interface IOrganizationServiceConfig extends IServiceConfig {
}

interface ISerializableOrganization extends IOrganization {
  serialize(): IOrganization;
}

export class OrganizationService extends BaseService<
IOrganization,
RequestCreateOrganization,
RequestUpdateOrganization
> {
  public dataRepository: OrganizationDataRepository;

  private readonly cacheService?: ICacheService;

  public constructor(config: IOrganizationServiceConfig) {
    super(config);
    this.dataRepository = config.dataRepository as OrganizationDataRepository;
    this.cacheService = config.services?.cacheService as ICacheService | undefined;
  }

  private static serializeOrganization(organization: IOrganization): IOrganization {
    const candidate = organization as Partial<ISerializableOrganization>;
    return typeof candidate.serialize === 'function'
      ? candidate.serialize()
      : organization;
  }

  private static sortPayload(payload: any): any {
    if (Array.isArray(payload)) {
      return payload.map((item) => OrganizationService.sortPayload(item));
    }
    if (!payload || typeof payload !== 'object') {
      return payload;
    }
    return Object.keys(payload)
      .sort()
      .reduce((acc, key) => {
        acc[key] = OrganizationService.sortPayload(payload[key]);
        return acc;
      }, {} as Record<string, any>);
  }

  private async getCacheVersion(): Promise<number> {
    if (!this.cacheService) return 1;
    return this.cacheService.getVersion('organizations');
  }

  private async invalidateReadCache(): Promise<void> {
    if (!this.cacheService) return;
    await this.cacheService.bumpVersion('organizations');
  }

  public async create(data: RequestCreateOrganization): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.create(data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async update(
    id: string,
    data: RequestUpdateOrganization
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.update(id, data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async delete(id: string): Promise<IServiceResponse<boolean>> {
    const serviceResponse: IServiceResponse<boolean> = {};
    try {
      serviceResponse.result = await this.dataRepository.delete(id);
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async getOneById(id: string): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      const version = await this.getCacheVersion();
      const cacheKey = `organizations:v${version}:getOneById:${id}`;
      const cached = await this.cacheService?.get<IOrganization>(cacheKey);
      if (cached) {
        serviceResponse.result = cached;
        return serviceResponse;
      }
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.getOneById(id)
      );
      if (serviceResponse.result) {
        await this.cacheService?.set(cacheKey, serviceResponse.result);
      }
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async getAll(
    filters: Record<string, string | number>,
    paging: IPagingRequest
  ): Promise<IServiceResponse<IOrganization[]>> {
    const serviceResponse: IServiceResponse<IOrganization[]> = {};
    try {
      const version = await this.getCacheVersion();
      const cacheKey = `organizations:v${version}:getAll:${JSON.stringify(
        OrganizationService.sortPayload({ filters, paging })
      )}`;
      const cached = await this.cacheService?.get<IServiceResponse<IOrganization[]>>(cacheKey);
      if (cached) {
        return cached;
      }
      const result = await this.dataRepository.getAll(filters, paging);
      const serializedResult = {
        ...result,
        result: result.result.map((organization) => (
          OrganizationService.serializeOrganization(organization)
        ))
      };
      await this.cacheService?.set(cacheKey, serializedResult);
      return serializedResult;
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async createAddress(
    id: string,
    data: RequestCreateAddress
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.createAddress(id, data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async updateAddress(
    id: string,
    addressId: string,
    data: RequestUpdateAddress
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.updateAddress(id, addressId, data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async deleteAddress(
    id: string,
    addressId: string
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.deleteAddress(id, addressId)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async createPhone(
    id: string,
    data: RequestCreatePhone
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.createPhone(id, data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async updatePhone(
    id: string,
    phoneId: string,
    data: RequestUpdatePhone
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.updatePhone(id, phoneId, data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async deletePhone(id: string, phoneId: string): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.deletePhone(id, phoneId)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async createEmail(
    id: string,
    data: RequestCreateEmail
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.createEmail(id, data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async updateEmail(
    id: string,
    emailId: string,
    data: RequestUpdateEmail
  ): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.updateEmail(id, emailId, data)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async deleteEmail(id: string, emailId: string): Promise<IServiceResponse<IOrganization>> {
    const serviceResponse: IServiceResponse<IOrganization> = {};
    try {
      serviceResponse.result = OrganizationService.serializeOrganization(
        await this.dataRepository.deleteEmail(id, emailId)
      );
      await this.invalidateReadCache();
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public static compile(config: IOrganizationServiceConfig): OrganizationService {
    return new OrganizationService(config);
  }
}
