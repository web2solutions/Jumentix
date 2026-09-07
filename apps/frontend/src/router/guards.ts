import type { RouteLocationNormalized } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

/** Returns the redirect target for a route, or null when it is allowed. */
export const requireAuthRedirect = (to: RouteLocationNormalized): string | null => {
  if (to.meta.public === true) {
    return null;
  }
  const auth = useAuthStore();
  return auth.isAuthenticated() ? null : '/login';
};
