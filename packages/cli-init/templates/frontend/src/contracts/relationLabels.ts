import { getSharedApiClient } from '@/contracts/apiClient';
import { entityPrimaryKey, fieldDescriptors, listOperationForEntity } from '@/contracts/formSchema';
import { listCapabilities } from '@/contracts/listSchema';
import { can } from '@/contracts/rbac';
import { isCanaOpen } from '@/data/db';
import { listLocal } from '@/data/localRepository';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

import type { FieldDescriptor } from '@/contracts/formSchema';

type Rows = Record<string, unknown>[];
type Relation = NonNullable<FieldDescriptor['relation']>;

/**
 * Display labels for an `x-relation` foreign key, keyed by the stored value.
 *
 * Candidates come from the target entity's `<Entity>ArrayOf` operation (or the
 * local Cana store offline), never from a hardcoded operation id. Anything the
 * caller cannot read — no list operation, RBAC refusal, network error — yields
 * an empty map, so callers fall back to the raw value instead of failing.
 */
export const loadRelationLabels = async (relation: Relation): Promise<Record<string, string>> => {
  const operationId = listOperationForEntity(relation.entity);
  if (!operationId) return {};
  try {
    const capabilities = listCapabilities(operationId);
    let list: Rows;
    if (isCanaOpen()) {
      const size = capabilities?.maxSize ?? 100;
      list = (await listLocal(relation.entity, { page: 1, size })).result;
    } else if (!can(useProfileStore().record?.roles, operationId)) {
      list = [];
    } else {
      const response = await getSharedApiClient().request<{ result?: Rows } | Rows>({
        operationId,
        query: capabilities ? { page: 1, size: capabilities.maxSize } : undefined,
        headers: { Authorization: useAuthStore().token }
      });
      list = Array.isArray(response) ? response : (response.result ?? []);
    }
    const labelField = relation.display ?? 'name';
    const match = relation.match || entityPrimaryKey(relation.entity);
    return Object.fromEntries(
      list.map((row) => [String(row[match] ?? row.id), String(row[labelField] ?? row[match] ?? '')])
    );
  } catch {
    return {};
  }
};

/**
 * The `x-relation` of `field` on schema `entity`, when it declares one.
 *
 * `undefined` for a schema name the bundled OAS does not declare — callers
 * (dashboard metrics) pass caller-supplied schema names that are not always
 * real entities, and `fieldDescriptors` throws on those.
 */
export const relationFor = (entity: string, field: string): Relation | undefined => {
  try {
    return fieldDescriptors(entity).find((descriptor) => descriptor.name === field)?.relation;
  } catch {
    return undefined;
  }
};
