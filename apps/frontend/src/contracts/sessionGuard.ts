import type { Router } from 'vue-router';

import { getSharedApiClient } from '@/contracts/apiClient';
import { appOperations } from '@/contracts/appOperations';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

/**
 * Session guard (session expiry auto-redirect): the SDK is the only UI↔server
 * channel, so a 401 on any non-auth operation means the session is dead —
 * expire locally and land on /login from ANY page, not just /profile.
 * Auth operations (login/register) are excluded: a 401 there is a wrong
 * password, not an expired session.
 */

// Read at event time: the ids are configurable (JUM-780) and a generated app
// may install them after this module loads.
const isAuthOperation = (operationId: string): boolean => {
  const { login, register } = appOperations().auth;
  return operationId === login || operationId === register;
};

/** 401 handler wired to the SDK event stream. Returns true when it expired. */
export const handleSdkEvent = (
  event: { type: string; status?: number; operationId: string },
  expire: () => void,
  redirect: () => void
): boolean => {
  if (event.type !== 'request:error' || event.status !== 401) return false;
  if (isAuthOperation(event.operationId)) return false;
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
    const profile = useProfileStore();
    // Reset the profile too: roles cached from the dead session would otherwise
    // survive into the next login in the same tab (JUM-776 e2e finding).
    handleSdkEvent(event, () => { auth.expire(); profile.reset(); }, () => {
      if (router.currentRoute.value.meta.public !== true) {
        router.push('/login');
      }
    });
  });
};
