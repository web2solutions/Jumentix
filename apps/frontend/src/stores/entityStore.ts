import { defineStore } from 'pinia';

import { getSharedApiClient } from '@/contracts/apiClient';
import {
  asListPage, listCapabilities, toQueryParams, type ListPage, type ListQuery
} from '@/contracts/listSchema';
import { useAuthStore } from '@/stores/auth';

import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';

/**
 * Generic entity store factory (JUM-772): one pinia store per X-CRUD entity,
 * every action mapping 1:1 to an operationId declared in the bundled OAS
 * (requirement 136). Bearer token comes from the auth session.
 *
 * `list` sends the server-side query (JUM-778) when the operation declares
 * `x-list-capabilities`; the response is normalized to the `{ result, page,
 * size, total }` envelope either way, so callers never branch on shape.
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
    const response = await getSharedApiClient().request<unknown>({
      operationId: config.operations.list,
      query: capabilities ? toQueryParams({ ...query, page, size }) : undefined,
      headers: headers()
    });
    return asListPage<T>(response, { page, size });
  };

  const create = async <T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> => {
    const client = getSharedApiClient();
    return client.request<T>({ operationId: config.operations.create, body, headers: headers() });
  };

  const update = async <T = Record<string, unknown>>(
    id: string,
    body: Record<string, unknown>
  ): Promise<T> => (
    getSharedApiClient().request<T>({
      operationId: config.operations.update,
      pathParams: { id },
      body: { ...body, id },
      headers: headers()
    })
  );

  const remove = async (id: string): Promise<void> => {
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
