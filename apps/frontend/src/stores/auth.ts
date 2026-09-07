import { ref } from 'vue';
import { defineStore } from 'pinia';

import { createApiClient } from '@/contracts/apiClient';

const STORAGE_KEY = 'jumentix-frontend-auth';

interface AuthorizationHeader {
  Authorization: string;
}

interface PersistedAuth {
  token: string;
  username: string;
}

const readPersisted = (): PersistedAuth | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PersistedAuth;
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

    await createApiClient().request({
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

    const response = await createApiClient().request<AuthorizationHeader>({
      operationId: 'login',
      body: {
        username: input.username.trim(),
        password: input.password,
        schemaType: 'Bearer'
      }
    });

    token.value = response.Authorization;
    username.value = input.username.trim();
    persist({ token: token.value, username: username.value });
  };

  /** POST /auth/logout — bearer-secured; OAS RequestLogout: username. */
  const logout = async (): Promise<void> => {
    if (token.value) {
      await createApiClient().request({
        operationId: 'logout',
        body: { username: username.value },
        headers: { Authorization: token.value }
      });
    }
    token.value = '';
    username.value = '';
    persist(null);
  };

  return {
    token, username, isAuthenticated, register, login, logout
  };
});
