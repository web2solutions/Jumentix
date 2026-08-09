import type {
  IPagingRequest,
  IPagingResponse,
  IServiceResponse,
  IServiceConfig,
  IEventBus
} from '@src/modules/port';
import {
  BaseService
} from '@src/modules/port';
import { UUID } from '@src/modules/port/UUID';

import type { ICatalog } from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { CatalogDataRepository } from '@src/modules/Catalogs/adapters/out/persistence/CatalogDataRepository';
import { createCatalog } from '@src/modules/Catalogs/features/createCatalog';
import { updateCatalog } from '@src/modules/Catalogs/features/updateCatalog';
import { deleteCatalogById } from '@src/modules/Catalogs/features/deleteCatalogById';
import { restoreCatalog } from '@src/modules/Catalogs/features/restoreCatalog';
import { getCatalogById } from '@src/modules/Catalogs/features/getCatalogById';
import { getAllCatalogs } from '@src/modules/Catalogs/features/getAllCatalogs';
import { CatalogIntegrationEventName } from '@src/modules/Catalogs/events/contracts/CatalogIntegrationEventName';
import type { RequestCreateCatalog } from '@src/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { RequestUpdateCatalog } from '@src/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { RequestCatalogListOptions } from '@src/modules/Catalogs/interface/dto/RequestCatalogListOptions';

import { BaseError } from '@src/infra/exceptions';

/**
 * CatalogService — application service of the shared catalog (JUM-491).
 * Every successful write publishes its integration event on the mediator
 * (`catalogs.catalog.*`), carrying the new version, so synchronization
 * consumers reconcile against the same concurrency token the API enforces.
 * Event publication never breaks the primary flow (same rule as UserService).
 */
export class CatalogService
  extends BaseService<ICatalog, RequestCreateCatalog, RequestUpdateCatalog> {
  public dataRepository: CatalogDataRepository;

  private readonly eventBus?: IEventBus;

  public constructor(config: IServiceConfig) {
    super(config);
    this.dataRepository = config.dataRepository as CatalogDataRepository;
    this.eventBus = config.services?.eventBus as IEventBus | undefined;
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

  private static eventPayload(catalog: ICatalog | undefined, actor: string): Record<string, any> {
    return {
      id: catalog?.id,
      organization: catalog?.organization,
      version: catalog?.version,
      actor
    };
  }

  public async create(
    data: RequestCreateCatalog,
    actor: string = ''
  ): Promise<IServiceResponse<ICatalog>> {
    const serviceResponse: IServiceResponse<ICatalog> = {};
    try {
      const createdCatalog = await createCatalog(
        { ...data, createdBy: actor },
        this.dataRepository
      );
      serviceResponse.result = createdCatalog;
      await this.publishEvent(
        CatalogIntegrationEventName.Created,
        CatalogService.eventPayload(createdCatalog, actor)
      );
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async update(
    id: string,
    data: RequestUpdateCatalog,
    actor: string = ''
  ): Promise<IServiceResponse<ICatalog>> {
    const serviceResponse: IServiceResponse<ICatalog> = {};
    try {
      UUID.parse(id);
      const updatedCatalog = await updateCatalog(id, data, this.dataRepository, actor);
      serviceResponse.result = updatedCatalog;
      await this.publishEvent(
        CatalogIntegrationEventName.Updated,
        CatalogService.eventPayload(updatedCatalog, actor)
      );
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async delete(
    id: string,
    expectedVersion?: number,
    actor: string = ''
  ): Promise<IServiceResponse<boolean>> {
    const serviceResponse: IServiceResponse<boolean> = {};
    try {
      UUID.parse(id);
      const current = await getCatalogById(id, this.dataRepository);
      serviceResponse.result = await deleteCatalogById(
        id,
        expectedVersion ?? -1,
        this.dataRepository,
        actor
      );
      await this.publishEvent(
        CatalogIntegrationEventName.Deleted,
        {
          id,
          organization: current.organization,
          version: (expectedVersion ?? -1) + 1,
          actor
        }
      );
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async restore(
    id: string,
    expectedVersion: number,
    actor: string = ''
  ): Promise<IServiceResponse<ICatalog>> {
    const serviceResponse: IServiceResponse<ICatalog> = {};
    try {
      UUID.parse(id);
      const restoredCatalog = await restoreCatalog(id, expectedVersion, this.dataRepository, actor);
      serviceResponse.result = restoredCatalog;
      await this.publishEvent(
        CatalogIntegrationEventName.Restored,
        CatalogService.eventPayload(restoredCatalog, actor)
      );
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async getOneById(id: string): Promise<IServiceResponse<ICatalog>> {
    const serviceResponse: IServiceResponse<ICatalog> = {};
    try {
      UUID.parse(id);
      serviceResponse.result = await getCatalogById(id, this.dataRepository);
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public async getAll(
    filters: Record<string, string|number>,
    paging: IPagingRequest,
    options: RequestCatalogListOptions = {}
  ): Promise<IServiceResponse<ICatalog[]>> {
    const serviceResponse: IServiceResponse<ICatalog[]> = {};
    try {
      const result: IPagingResponse<ICatalog[]> = await getAllCatalogs(
        filters,
        paging,
        this.dataRepository,
        options
      );
      serviceResponse.result = result.result;
      serviceResponse.total = result.total;
      serviceResponse.page = result.page;
      serviceResponse.size = result.size;
    } catch (error) {
      serviceResponse.error = error as BaseError;
    }
    return serviceResponse;
  }

  public static compile(config: IServiceConfig): CatalogService {
    return new CatalogService(config);
  }
}
