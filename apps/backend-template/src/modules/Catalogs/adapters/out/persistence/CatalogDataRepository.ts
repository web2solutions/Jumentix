import type { IStore } from '@src/infra/ports/persistence/IStore';
import {
  throwIfNotFound,
  canNotBeEmpty
} from '@src/shared/validators';
import { ConflictError } from '@src/infra/exceptions';
import type {
  ICatalog
} from '@src/modules/Catalogs/domain/Entity/ICatalog';
import { Catalog } from '@src/modules/Catalogs/domain/Model/Catalog';
import type { RequestCreateCatalog } from '@src/modules/Catalogs/interface/dto/RequestCreateCatalog';
import type { RequestUpdateCatalog } from '@src/modules/Catalogs/interface/dto/RequestUpdateCatalog';
import type { RequestCatalogListOptions } from '@src/modules/Catalogs/interface/dto/RequestCatalogListOptions';
import type { ICatalogRepository } from '@src/modules/Catalogs/service/ports/ICatalogRepository';
import type {
  IPagingRequest,
  IPagingResponse,
  IRepoConfig
} from '@src/modules/port';
import {
  BaseRepo
} from '@src/modules/port';

import { _DEFAULT_PAGE_SIZE_ } from '@src/config/constants';

/**
 * CatalogDataRepository — the outbound persistence adapter for the shared
 * catalog (JUM-491).
 *
 * This is where optimistic concurrency is enforced: every mutation reads the
 * current record and refuses the write when the caller's expected version is
 * stale, throwing a `ConflictError` whose metadata carries the current
 * version AND the current record — the reviewable rejection path the issue
 * demands, because the client can reconcile against real server state instead
 * of losing the user's edit. Drivers with native conditional writes should
 * push the same check down to `IStoreMutationOptions.expectedVersion`; the
 * read-check-write here is the reference behaviour every driver must match.
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
    CatalogDataRepository.throwIfStale(current, expectedVersion ?? -1);
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
    const {
      result, page, size, total
    } = await this.store.getAll(scopedFilters, paging);
    const currentPage = page ?? paging?.page ?? 1;
    const currentSize = size ?? paging?.size ?? this.limit;
    const rows = result ?? [];
    const pagedResponse: IPagingResponse<Catalog[]> = {
      page: currentPage,
      size: currentSize,
      total,
      result: rows.map((rawDoc: ICatalog) => new Catalog(rawDoc as RequestCreateCatalog & ICatalog))
    };
    return pagedResponse;
  }

  public static compile(config: IRepoConfig): CatalogDataRepository {
    return new CatalogDataRepository(config);
  }
}
