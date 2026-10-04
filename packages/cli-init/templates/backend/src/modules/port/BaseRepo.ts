import { DEFAULT_PAGE_SIZE } from '@src/config/constants';

import type { IDatabaseClient } from '@src/infra/persistence/port/IDatabaseClient';

import type { IPagingRequest } from './IPagingRequest';
import type { IPagingResponse } from './IPagingResponse';
import type { IRepoConfig } from './IRepoConfig';

abstract class BaseRepo<Model, RequestCreateDTO, RequestUpdateDTO> {
  public databaseClient: IDatabaseClient;

  public limit: number;

  constructor(config: IRepoConfig) {
    const { limit, databaseClient } = config;

    this.databaseClient = databaseClient;

    this.limit = limit ?? DEFAULT_PAGE_SIZE;
  }

  public abstract create(data: RequestCreateDTO): Promise<Model>;

  public abstract update(id: string, data: RequestUpdateDTO): Promise<Model>;

  public abstract delete(id: string): Promise<boolean>;

  public abstract getOneById(id: string): Promise<Model>;

  public abstract getAll(
    filters: Record<string, string | number>,
    paging: IPagingRequest
  ): Promise<IPagingResponse<Model[]>>;
}

export default BaseRepo;
