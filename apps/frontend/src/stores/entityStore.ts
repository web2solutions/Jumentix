import { defineStore } from 'pinia';

import { getSharedApiClient } from '@/contracts/apiClient';
import {
  asListPage, listCapabilities, toQueryParams, type ListPage, type ListQuery
} from '@/contracts/listSchema';
import { isCanaOpen } from '@/data/db';
import { listLocal } from '@/data/localRepository';
import { drainOutbox, enqueueMutation } from '@/data/outbox';
import { useAuthStore } from '@/stores/auth';

import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';

/**
 * Generic entity store factory (JUM-772 / JUM-804): OAS operationIds for the
 * server path; Cana + outbox when the local client is open.
 */
export const createEntityStore = (config: XCrudEntityConfig) => defineStore(`xcrud-${config.entity}`, () => {
  const capabilities = listCapabilities(config.operations.list);

  const headers = () => {
    const auth = useAuthStore();
    if (!auth.token) {
      throw new Error('No authenticated session.');
    }
    return { Authorization: auth.token };
  };

  const list = async <T = Record<string, unknown>>(query: ListQuery = {}): Promise<ListPage<T>> => {
    const page = query.page ?? 1;
    const size = query.size ?? capabilities?.defaultSize ?? 30;
    if (isCanaOpen()) {
      return listLocal<T & Record<string, unknown>>(config.entity, {
        ...query,
        page,
        size,
        searchFields: capabilities?.searchable ?? config.searchFields
      });
    }
    const response = await getSharedApiClient().request<unknown>({
      operationId: config.operations.list,
      query: capabilities ? toQueryParams({ ...query, page, size }) : undefined,
      headers: headers()
    });
    return asListPage<T>(response, { page, size });
  };

  const create = async <T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> => {
    if (isCanaOpen()) {
      const record = await enqueueMutation({
        entity: config.entity,
        kind: 'create',
        payload: body,
        operations: config.operations
      }) as T;
      drainOutbox().catch(() => undefined);
      return record;
    }
    return getSharedApiClient().request<T>({
      operationId: config.operations.create, body, headers: headers()
    });
  };

  const update = async <T = Record<string, unknown>>(
    id: string,
    body: Record<string, unknown>
  ): Promise<T> => {
    if (isCanaOpen()) {
      const record = await enqueueMutation({
        entity: config.entity,
        kind: 'update',
        key: id,
        payload: body,
        operations: config.operations
      }) as T;
      drainOutbox().catch(() => undefined);
      return record;
    }
    return getSharedApiClient().request<T>({
      operationId: config.operations.update,
      pathParams: { id },
      body: { ...body, id },
      headers: headers()
    });
  };

  const remove = async (id: string): Promise<void> => {
    if (isCanaOpen()) {
      await enqueueMutation({
        entity: config.entity,
        kind: 'delete',
        key: id,
        payload: { id },
        operations: config.operations
      });
      drainOutbox().catch(() => undefined);
      return;
    }
    await getSharedApiClient().request({
      operationId: config.operations.delete,
      pathParams: { id },
      headers: headers()
    });
  };

  return {
    capabilities, list, create, update, remove
  };
});
