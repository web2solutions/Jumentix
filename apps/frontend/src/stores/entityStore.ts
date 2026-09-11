import { defineStore } from 'pinia';

import { getSharedApiClient } from '@/contracts/apiClient';
import { useAuthStore } from '@/stores/auth';

import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';

/**
 * Generic entity store factory (JUM-772): one pinia store per X-CRUD entity,
 * every action mapping 1:1 to an operationId declared in the bundled OAS
 * (requirement 136). Bearer token comes from the auth session.
 */
export const createEntityStore = (config: XCrudEntityConfig) => defineStore(`xcrud-${config.entity}`, () => {
  const headers = () => {
    const auth = useAuthStore();
    if (!auth.token) {
      throw new Error('No authenticated session.');
    }
    return { Authorization: auth.token };
  };

  const list = async <T = Record<string, unknown>>(): Promise<T[]> => {
    const response = await getSharedApiClient().request<{ result?: T[] } | T[]>({
      operationId: config.operations.list,
      headers: headers()
    });
    if (Array.isArray(response)) return response;
    return response.result ?? [];
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
    list, create, update, remove
  };
});
