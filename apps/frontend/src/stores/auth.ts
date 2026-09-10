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
 * payload holds the user id (and username/firstName). Decoded client-side as
 * an identity claim — never verified, never trusted for authorization.
 */
export const decodeJwtUserId = (token: string): string => {
  const payload = token.split('.')[1];
  if (!payload) {
    return '';
  }
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { id?: string };
    return decoded.id ?? '';
  } catch {
    return '';
  }
};

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
   * POST /auth/register — OAS RequestRegister: firstName, username,
   * password (minLength 8), optional organization uuid.
   */
  const register = async (input: {
    firstName: string;
    username: string;
    password: string;
    organization?: string;
  }): Promise<void> => {
    if (!input.firstName.trim()) {
      throw new Error('First name is required.');
    }
    if (!input.username.trim()) {
      throw new Error('Username is required.');
    }
    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    await getSharedApiClient().request({
      operationId: 'register',
      body: {
        firstName: input.firstName.trim(),
        username: input.username.trim(),
        password: input.password,
        ...(input.organization ? { organization: input.organization } : {})
      }
    });
  };

  /**
   * POST /auth/login — OAS RequestLogin: username, password (minLength 2),
   * schemaType default Bearer. Response: { Authorization: 'Bearer …' }.
   */
  const login = async (input: { username: string; password: string }): Promise<void> => {
    if (!input.username.trim()) {
      throw new Error('Username is required.');
    }
    if (input.password.length < 2) {
      throw new Error('Password must be at least 2 characters.');
    }

    const response = await getSharedApiClient().request<AuthorizationHeader>({
      operationId: 'login',
      body: {
        username: input.username.trim(),
        password: input.password,
        schemaType: 'Bearer'
      }
    });

    token.value = response.Authorization;
    username.value = input.username.trim();
    userId.value = decodeJwtUserId(response.Authorization);
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
