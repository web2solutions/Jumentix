import type { Router } from 'vue-router';

import { getSharedApiClient } from '@/contracts/apiClient';
import { useAuthStore } from '@/stores/auth';

/**
 * Session guard (session expiry auto-redirect): the SDK is the only UI↔server
 * channel, so a 401 on any non-auth operation means the session is dead —
 * expire locally and land on /login from ANY page, not just /profile.
 * Auth operations (login/register) are excluded: a 401 there is a wrong
 * password, not an expired session.
 */

const AUTH_OPERATIONS = new Set(['login', 'register']);

/** 401 handler wired to the SDK event stream. Returns true when it expired. */
export const handleSdkEvent = (
  event: { type: string; status?: number; operationId: string },
  expire: () => void,
  redirect: () => void
): boolean => {
  if (event.type !== 'request:error' || event.status !== 401) return false;
  if (AUTH_OPERATIONS.has(event.operationId)) return false;
  expire();
  redirect();
  return true;
};

/** True when the stored session exists but its JWT exp already passed. */
export const expireIfStaleSession = (auth: ReturnType<typeof useAuthStore>): boolean => {
  if (auth.isAuthenticated() && auth.isSessionExpired()) {
    auth.expire();
    return true;
  }
  return false;
};

/** Installs the global 401→/login reaction on the shared SDK client. */
export const installSessionGuard = (router: Router): void => {
  const client = getSharedApiClient();
  client.subscribe((event) => {
    const auth = useAuthStore();
    handleSdkEvent(event, () => auth.expire(), () => {
      if (router.currentRoute.value.meta.public !== true) {
        router.push('/login');
      }
    });
  });
};
