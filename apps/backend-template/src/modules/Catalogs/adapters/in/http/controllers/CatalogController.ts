import type { IController, IControllerFactory } from '@src/interface/HTTP/ports';
import { BaseController } from '@src/interface/HTTP/ports/BaseController';
import { Security } from '@src/infra/security';
import { _INFRA_NOT_IMPLEMENTED_ } from '@src/config/constants';
import { ForbiddenError, ValidationError } from '@src/infra/exceptions';
import {
  validateRequestAgainstOAS
} from '@src/interface/HTTP/validators';
import { Authorize } from '@src/shared/decorators/guard/Authorize';

import { BaseDomainEvent } from '@src/modules/port/BaseDomainEvent';
import type {
  IServiceResponse
} from '@src/modules/port';
import {
  setFilter,
  setPaging
} from '@src/modules/port';
import type {
  ICatalog
} from '@src/modules/Catalogs/domain/Entity/ICatalog';
import type { RequestCreateCatalog } from '@src/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { RequestUpdateCatalog } from '@src/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { ICatalogUseCases } from '@src/modules/Catalogs/application/ports/ICatalogUseCases';
import type {
  ITenantAuthorizationDecision
} from '@src/modules/Users/domain/security/TenantAuthorizationPolicy';
import {
  decideCatalogAccess,
  resolveCatalogCollectionScope,
  resolveCatalogCreationOrganization
} from '@src/modules/Catalogs/domain/security/CatalogAuthorizationPolicy';

/**
 * CatalogController — the shared catalog's inbound HTTP adapter (JUM-491).
 * Every operation is `@Authorize()`-guarded (scope check against the OAS
 * security entry, server-side — a client cannot grant itself access), the
 * payload is validated against the OAS operation, and the TENANT-RBAC
 * catalog policy decides organization scope before any use case runs.
 */
export class CatalogController extends BaseController implements IController {
  private readonly catalogUseCases: ICatalogUseCases;

  constructor(factory: IControllerFactory) {
    super(factory);
    if (!factory.catalogUseCases) {
      const error = new Error('CatalogUseCases is not implemented');
      error.name = _INFRA_NOT_IMPLEMENTED_;
      throw error;
    }
    this.catalogUseCases = factory.catalogUseCases;
  }

  // eslint-disable-next-line class-methods-use-this
  private getAuthenticatedUser(event: BaseDomainEvent): Record<string, any> {
    return ((event as any).authenticatedUser || {}) as Record<string, any>;
  }

  // eslint-disable-next-line class-methods-use-this
  private getActor(event: BaseDomainEvent): string {
    const authenticatedUser = this.getAuthenticatedUser(event);
    return (authenticatedUser.username || authenticatedUser.id || '') as string;
  }

  // eslint-disable-next-line class-methods-use-this
  private throwIfTenantAccessDenied(decision: ITenantAuthorizationDecision): void {
    if (!decision.allowed) {
      throw new ForbiddenError(decision.reason);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private parseExpectedVersion(rawVersion: any): number {
    const expectedVersion = Number(rawVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new ValidationError(
        'version must be a positive integer - the catalog concurrency token'
      );
    }
    return expectedVersion;
  }

  private async enforceCatalogReadScope(event: BaseDomainEvent, catalogId: string): Promise<void> {
    const authenticatedUser = this.getAuthenticatedUser(event);
    const { result: targetCatalog, error } = await this.catalogUseCases.getOneById(catalogId);
    if (error || !targetCatalog) {
      throw error || new ForbiddenError('Insufficient permission - target catalog not available');
    }
    this.throwIfTenantAccessDenied(decideCatalogAccess(authenticatedUser, targetCatalog));
  }

  @Authorize()
  public async create(
    event: BaseDomainEvent
  ): Promise<IServiceResponse<ICatalog>> {
    validateRequestAgainstOAS(
      this.openApiSpecification,
      event.schemaOAS,
      event
    );
    const requestCreateCatalog = event.input as RequestCreateCatalog;
    const authenticatedUser = this.getAuthenticatedUser(event);
    const tenantBinding = resolveCatalogCreationOrganization(
      authenticatedUser,
      requestCreateCatalog.organization
    );
    this.throwIfTenantAccessDenied(tenantBinding.decision);
    requestCreateCatalog.organization = tenantBinding.organization;
    const { result, error } = await this.catalogUseCases.create(
      requestCreateCatalog,
      this.getActor(event)
    );
    return { result, error };
  }

  @Authorize()
  public async update(
    event: BaseDomainEvent
  ): Promise<IServiceResponse<ICatalog>> {
    validateRequestAgainstOAS(
      this.openApiSpecification,
      event.schemaOAS,
      event
    );
    const requestUpdateCatalog = event.input as RequestUpdateCatalog;
    const catalogId = Security.xss(event.params.id);
    await this.enforceCatalogReadScope(event, catalogId);
    const { result, error } = await this.catalogUseCases.update(
      catalogId,
      requestUpdateCatalog,
      this.getActor(event)
    );
    return { result, error };
  }

  @Authorize()
  public async delete(
    event: BaseDomainEvent
  ): Promise<IServiceResponse<boolean>> {
    validateRequestAgainstOAS(
      this.openApiSpecification,
      event.schemaOAS,
      event
    );
    const catalogId = Security.xss(event.params.id);
    await this.enforceCatalogReadScope(event, catalogId);
    const expectedVersion = this.parseExpectedVersion(event.queryString?.version);
    const { result, error } = await this.catalogUseCases.delete(
      catalogId,
      expectedVersion,
      this.getActor(event)
    );
    return { result, error };
  }

  @Authorize()
  public async restore(
    event: BaseDomainEvent
  ): Promise<IServiceResponse<ICatalog>> {
    validateRequestAgainstOAS(
      this.openApiSpecification,
      event.schemaOAS,
      event
    );
    const catalogId = Security.xss(event.params.id);
    await this.enforceCatalogReadScope(event, catalogId);
    const requestVersion = (event.input as RequestUpdateCatalog)?.version;
    const expectedVersion = this.parseExpectedVersion(requestVersion);
    const { result, error } = await this.catalogUseCases.restore(
      catalogId,
      expectedVersion,
      this.getActor(event)
    );
    return { result, error };
  }

  @Authorize()
  public async getOneById(
    event: BaseDomainEvent
  ): Promise<IServiceResponse<ICatalog>> {
    validateRequestAgainstOAS(
      this.openApiSpecification,
      event.schemaOAS,
      event
    );
    const catalogId = Security.xss(event.params.id);
    await this.enforceCatalogReadScope(event, catalogId);
    const { result, error } = await this.catalogUseCases.getOneById(catalogId);
    return { result, error };
  }

  @Authorize()
  public async getAll(
    event: BaseDomainEvent
  ): Promise<IServiceResponse<ICatalog[]>> {
    validateRequestAgainstOAS(
      this.openApiSpecification,
      event.schemaOAS,
      event
    );
    const filters = setFilter(event);
    const authenticatedUser = this.getAuthenticatedUser(event);
    const tenantScope = resolveCatalogCollectionScope(authenticatedUser);
    this.throwIfTenantAccessDenied(tenantScope.decision);
    const paging = setPaging(event);
    const includeDeleted = String(event.queryString?.includeDeleted ?? '') === 'true';
    const result = await this.catalogUseCases.getAll(
      { ...filters, ...tenantScope.filters },
      paging,
      { includeDeleted }
    );
    return result;
  }

  public static compile(factory: IControllerFactory) {
    return new CatalogController(factory);
  }
}
