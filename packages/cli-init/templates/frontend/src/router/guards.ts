import type { RouteLocationNormalized } from 'vue-router';

import { expireIfStaleSession } from '@/contracts/sessionGuard';
import { can } from '@/contracts/rbac';
import { isCanaOpen } from '@/data/db';
import { findModule } from '@/modules/manifest';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

/** Returns the redirect target for a route, or null when it is allowed. */
export const requireAuthRedirect = (to: RouteLocationNormalized): string | null => {
  if (to.meta.public === true) {
    return null;
  }
  const auth = useAuthStore();
  if (expireIfStaleSession(auth)) {
    return '/login';
  }
  return auth.isAuthenticated() ? null : '/login';
};

/** Shell stays unreachable until the first full load (or delta) finishes. */
export const requireSyncRedirect = async (
  to: RouteLocationNormalized
): Promise<string | null> => {
  if (to.meta.public === true) return null;
  const auth = useAuthStore();
  if (!auth.isAuthenticated()) return null;
  if (!isCanaOpen()) return null;
  const { isSynced } = await import('@/data/sync');
  const synced = await isSynced();
  if (to.name === 'Sync') {
    return synced ? '/dashboard' : null;
  }
  return synced ? null : '/sync';
};

const operationIdFor = (to: RouteLocationNormalized): string | undefined => {
  const fromMeta = to.meta.operationId as string | undefined;
  if (fromMeta) return fromMeta;
  if (to.name !== 'Module') return undefined;
  const moduleId = typeof to.params.moduleId === 'string' ? to.params.moduleId : '';
  const tab = typeof to.params.tab === 'string' ? to.params.tab : '';
  return findModule(moduleId)?.entities.find((item) => item.id === tab)?.config.operations.list;
};

/**
 * Scope guard (JUM-772): routes declaring `meta.operationId` require the
 * operation's OAS security scopes. Roles come from the profile record (loaded
 * once). The backend enforces the same scopes — this is UX, not security.
 */
export const requireScopeRedirect = async (
  to: RouteLocationNormalized
): Promise<string | null> => {
  const operationId = operationIdFor(to);
  if (!operationId) return null;
  const profile = useProfileStore();
  // Always go through load(): concurrent callers share the in-flight request,
  // so a guard firing while the shell is still loading waits for it (JUM-772).
  if (!profile.record) {
    try {
      await profile.load();
    } catch {
      return '/dashboard';
    }
  }
  return can(profile.record?.roles ?? [], operationId) ? null : '/dashboard';
};
