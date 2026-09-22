import type { IStore } from '@src/infra/ports/persistence/IStore';
import {
  throwIfNotFound,
  canNotBeEmpty
} from '@src/shared/validators';
import { ConflictError } from '@src/infra/exceptions';
import type { ICatalog } from '@service-management-api/modules/Catalogs/domain/Entity/ICatalog';
import { Catalog } from '@service-management-api/modules/Catalogs/domain/Model/Catalog';
import type { RequestCreateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { RequestUpdateCatalog } from '@service-management-api/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { RequestCatalogListOptions } from '@service-management-api/modules/Catalogs/interface/dto/RequestCatalogListOptions';
import type { ICatalogRepository } from '@service-management-api/modules/Catalogs/service/ports/ICatalogRepository';
import type {
  IPagingRequest,
  IPagingResponse,
  IRepoConfig
} from '@src/modules/port';
import { BaseRepo } from '@src/modules/port';
import { _DEFAULT_PAGE_SIZE_ } from '@src/config/constants';

/**
 * Outbound persistence adapter for the Service Management shared catalog.
 *
 * Optimistic concurrency lives here as the portable reference behavior: native
 * drivers may push the same expected-version check into conditional writes, but
 * every driver must preserve this conflict payload shape for client recovery.
 */
export class CatalogDataRepository
  extends BaseRepo<Catalog, RequestCreateCatalog, RequestUpdateCatalog>
  implements ICatalogRepository {
  public store: IStore<ICatalog>;

  public limit: number;

  public constructor(config: IRepoConfig) {
    super(config);
    const { limit } = config;
    this.store = this.databaseClient.stores.Catalog;
    this.limit = limit ?? _DEFAULT_PAGE_SIZE_;
  }

  private static throwIfStale(current: Catalog, expectedVersion: number): void {
    if (current.version !== expectedVersion) {
      throw new ConflictError(
        `Stale catalog version: expected ${expectedVersion}, current is ${current.version}`,
        undefined,
        {
          catalogId: current.id,
          expectedVersion,
          currentVersion: current.version,
          current: current.serialize()
        }
      );
    }
  }

  public async create(data: RequestCreateCatalog & { createdBy?: string }): Promise<Catalog> {
    canNotBeEmpty('name', data.name);
    const model: Catalog = new Catalog({ ...data, version: 1 });
    await this.store.create(model.id, model.serialize());
    return model;
  }

  public async update(id: string, data: RequestUpdateCatalog, actor: string = ''): Promise<Catalog> {
    const current = await this.getOneById(id);
    CatalogDataRepository.throwIfStale(current, data.version);
    const next = new Catalog({
      ...current.serialize(),
      name: data.name ?? current.name,
      description: data.description ?? current.description,
      design: data.design ?? current.design,
      provenance: data.provenance ?? current.provenance
    });
    next.bumpVersion(actor);
    await this.store.update(id, next.serialize());
    return next;
  }

  public async delete(id: string, expectedVersion?: number, actor: string = ''): Promise<boolean> {
    const current = await this.getOneById(id);
    // An absent expectedVersion is the unconditional-delete sentinel; the
    // staleness check only guards optimistic-concurrency deletes.
    if (expectedVersion !== undefined) {
      CatalogDataRepository.throwIfStale(current, expectedVersion);
    }
    const next = new Catalog({ ...current.serialize() });
    next.tombstone(actor);
    await this.store.update(id, next.serialize());
    return true;
  }

  public async restore(id: string, expectedVersion: number, actor: string = ''): Promise<Catalog> {
    const current = await this.getOneById(id);
    CatalogDataRepository.throwIfStale(current, expectedVersion);
    const next = new Catalog({ ...current.serialize() });
    next.restore(actor);
    await this.store.update(id, next.serialize());
    return next;
  }

  public async getOneById(id: string): Promise<Catalog> {
    const rawCatalog = await this.store.getOneById(id);
    throwIfNotFound(!!rawCatalog);
    return new Catalog({ ...(rawCatalog as ICatalog) } as RequestCreateCatalog & ICatalog);
  }

  public async getAll(
    filters: Record<string, string|number>,
    paging: IPagingRequest,
    options: RequestCatalogListOptions = {}
  ): Promise<IPagingResponse<Catalog[]>> {
    const scopedFilters: Record<string, string|number> = { ...filters };
    if (!options.includeDeleted) {
      scopedFilters.deletedAt = '';
    }
    // The repository owns the default page size: a bare request pages with
    // `this.limit`, and the store is told so instead of inventing its own
    // (JUM-777 moved paging into the shared list-query helpers, which default
    // to 10 when asked to page without a size).
    const effectivePaging: IPagingRequest = {
      ...paging,
      page: paging?.page ?? 1,
      size: paging?.size ?? this.limit
    };
    const {
      result, page, size, total
    } = await this.store.getAll(scopedFilters, effectivePaging);
    const currentPage = page ?? effectivePaging.page;
    const currentSize = size ?? effectivePaging.size;
    const rows = result ?? [];
    return {
      page: currentPage,
      size: currentSize,
      total,
      result: rows.map((rawDoc: ICatalog) => new Catalog(rawDoc as RequestCreateCatalog & ICatalog))
    };
  }

  public static compile(config: IRepoConfig): CatalogDataRepository {
    return new CatalogDataRepository(config);
  }
}
