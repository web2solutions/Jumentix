import { ref } from 'vue';
import { defineStore } from 'pinia';

import { getSharedApiClient } from '@/contracts/apiClient';

const STORAGE_KEY = 'jumentix-frontend-auth';

interface AuthorizationHeader {
  Authorization: string;
}

interface PersistedAuth {
  token: string;
  username: string;
  userId: string;
}

/**
 * The login response carries only the Authorization header, but the JWT
 * payload holds the user id and username. Decoded client-side as an identity
 * claim — never verified, never trusted for authorization.
 */
const decodeJwtPayload = (token: string): { id?: string; username?: string } => {
  const payload = token.split('.')[1];
  if (!payload) {
    return {};
  }
  try {
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      id?: string;
      username?: string;
    };
  } catch {
    return {};
  }
};

export const decodeJwtUserId = (token: string): string => decodeJwtPayload(token).id ?? '';

/**
 * Sessions persisted before JUM-761 carry no userId. Recover it from the
 * stored JWT when possible; a session whose user id cannot be recovered is
 * invalid, so it is dropped — and the route guard then redirects to /login
 * instead of letting a stale session reach protected pages.
 */
const readPersisted = (): PersistedAuth | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
    if (!parsed.token || !parsed.username) {
      return null;
    }
    const userId = parsed.userId || decodeJwtUserId(parsed.token);
    if (!userId) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { token: parsed.token, username: parsed.username, userId };
  } catch {
    return null;
  }
};

const persist = (value: PersistedAuth | null) => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
};

export const useAuthStore = defineStore('auth', () => {
  const persisted = readPersisted();
  const token = ref<string>(persisted?.token ?? '');
  const username = ref<string>(persisted?.username ?? '');
  const userId = ref<string>(persisted?.userId ?? '');

  const isAuthenticated = () => token.value.length > 0;

  /**
   * POST /auth/register. The body is the OAS RequestRegister collected by the
   * schema-driven form — field names come from the spec, not from this file
   * (JUM-766).
   */
  const register = async (body: Record<string, unknown>): Promise<void> => {
    await getSharedApiClient().request({ operationId: 'register', body });
  };

  /**
   * POST /auth/login. Response: { Authorization: 'Bearer …' } — session
   * identity (id + username) is read from the JWT payload.
   */
  const login = async (body: Record<string, unknown>): Promise<void> => {
    const response = await getSharedApiClient().request<AuthorizationHeader>({
      operationId: 'login',
      body
    });

    const claims = decodeJwtPayload(response.Authorization);
    token.value = response.Authorization;
    username.value = claims.username ?? String(body.username ?? '');
    userId.value = claims.id ?? '';
    persist({ token: token.value, username: username.value, userId: userId.value });
  };

  /** POST /auth/logout — bearer-secured; OAS RequestLogout: username. */
  const logout = async (): Promise<void> => {
    if (token.value) {
      await getSharedApiClient().request({
        operationId: 'logout',
        body: { username: username.value },
        headers: { Authorization: token.value }
      });
    }
    token.value = '';
    username.value = '';
    userId.value = '';
    persist(null);
  };

  /**
   * Local-only session clear: the backend already rejected this session (401)
   * or the persisted shape is invalid, so there is nothing to log out from.
   */
  const expire = (): void => {
    token.value = '';
    username.value = '';
    userId.value = '';
    persist(null);
  };

  return {
    token, username, userId, isAuthenticated, register, login, logout, expire
  };
});
