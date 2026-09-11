import { computed } from 'vue';

import { can } from '@/contracts/rbac';
import { useProfileStore } from '@/stores/profile';

/** RBAC for OAS-driven UI (JUM-772): roles of the signed-in user + can(). */
export const usePermissions = () => {
  const profile = useProfileStore();
  const roles = computed<string[]>(() => profile.record?.roles ?? []);

  /** Idempotent: roles come from the already-loaded profile record. */
  const ensure = async (): Promise<void> => {
    if (!profile.record && !profile.loading) {
      try {
        await profile.load();
      } catch {
        // roles stay empty → can() fails closed
      }
    }
  };

  const canOp = (operationId: string) => computed(() => can(roles.value, operationId));

  return { roles, ensure, canOp };
};
