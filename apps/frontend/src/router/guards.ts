import type { RouteLocationNormalized } from 'vue-router';

import { can } from '@/contracts/rbac';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

/** Returns the redirect target for a route, or null when it is allowed. */
export const requireAuthRedirect = (to: RouteLocationNormalized): string | null => {
  if (to.meta.public === true) {
    return null;
  }
  const auth = useAuthStore();
  return auth.isAuthenticated() ? null : '/login';
};

/**
 * Scope guard (JUM-772): routes declaring `meta.operationId` require the
 * operation's OAS security scopes. Roles come from the profile record (loaded
 * once). The backend enforces the same scopes — this is UX, not security.
 */
export const requireScopeRedirect = async (
  to: RouteLocationNormalized
): Promise<string | null> => {
  const operationId = to.meta.operationId as string | undefined;
  if (!operationId) return null;
  const profile = useProfileStore();
  if (!profile.record && !profile.loading) {
    try {
      await profile.load();
    } catch {
      return '/dashboard';
    }
  }
  return can(profile.record?.roles ?? [], operationId) ? null : '/dashboard';
};
