import { ref } from 'vue';
import { defineStore } from 'pinia';

import { getSharedApiClient } from '@/contracts/apiClient';
import { appOperations } from '@/contracts/appOperations';
import { isNotFoundError } from '@/contracts/errors';
import { useAuthStore } from '@/stores/auth';
import { t } from '@/i18n';

export interface UserEmail {
  id: string;
  type: string;
  email: string;
  isPrimary?: boolean;
}

export interface UserDocument {
  id: string;
  type: string;
  countryIssue: string;
  data: string;
}

export interface UserPhone {
  id: string;
  countryCode: string;
  localCode: string;
  number: string;
  isPrimary?: boolean;
}

export interface UserRecord {
  id: string;
  firstName: string;
  lastName?: string;
  avatar?: string;
  username: string;
  organization?: string;
  roles?: string[];
  emails: UserEmail[];
  documents: UserDocument[];
  phones: UserPhone[];
}

export interface ScalarProfileInput {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  username?: string;
  organization?: string;
}

/**
 * Profile store — every action maps 1:1 to an operationId declared in the
 * bundled OAS (requirement 136). All of them carry the bearer token and take
 * the user id from the auth session (decoded from the login JWT).
 */
export const useProfileStore = defineStore('profile', () => {
  const record = ref<UserRecord | null>(null);
  const loading = ref(false);
  let inflight: Promise<void> | null = null;

  const session = () => {
    const auth = useAuthStore();
    if (!auth.userId) {
      throw new Error('No authenticated session.');
    }
    return { userId: auth.userId, headers: { Authorization: auth.token } };
  };

  /** GET /users/{id} (operationId getOneById). Concurrent callers share one flight. */
  const load = async (): Promise<void> => {
    if (inflight) return inflight;
    const { userId, headers } = session();
    loading.value = true;
    inflight = (async () => {
      try {
        record.value = await getSharedApiClient().request<UserRecord>({
          operationId: appOperations().profile.get,
          pathParams: { id: userId },
          headers
        });
      } finally {
        loading.value = false;
        inflight = null;
      }
    })();
    return inflight;
  };

  /**
   * PUT /users/{id} (operationId update). The backend validates the full User
   * on update (username non-empty, emails minItems 1, …), so this sends the
   * current record merged with the edited scalars — never a partial body.
   */
  const saveScalars = async (input: ScalarProfileInput): Promise<void> => {
    if (!record.value) {
      throw new Error('Profile not loaded.');
    }
    const { userId, headers } = session();
    await getSharedApiClient().request<UserRecord>({
      operationId: appOperations().profile.update,
      pathParams: { id: userId },
      body: { ...record.value, ...input, id: userId },
      headers
    });
    await load();
  };

  /** PUT /users/{id}/updatePassword — OAS RequestUpdatePassword: min 8. */
  const changePassword = async (password: string): Promise<void> => {
    if (password.length < 8) {
      throw new Error(t('validation.minLength', { field: 'password', min: 8 }));
    }
    const { userId, headers } = session();
    await getSharedApiClient().request<UserRecord>({
      operationId: appOperations().profile.updatePassword,
      pathParams: { id: userId },
      body: { password },
      headers
    });
  };

  /**
   * Runs a sub-resource mutation and reloads. A 404 from a delete means the
   * record is already gone (double click or stale list) — that is not an
   * error for the user: the list reloads and the caller gets 'already-removed'.
   */
  const reloadAfter = async (
    operationId: string,
    extraPathParams: Record<string, string>,
    body?: unknown
  ): Promise<'updated' | 'already-removed'> => {
    const { userId, headers } = session();
    try {
      await getSharedApiClient().request({
        operationId,
        pathParams: { id: userId, ...extraPathParams },
        body,
        headers
      });
      await load();
      return 'updated';
    } catch (error) {
      if (isNotFoundError(error)) {
        await load();
        return 'already-removed';
      }
      throw error;
    }
  };

  const addEmail = (input: { email: string; type: string; isPrimary?: boolean }) => {
    return reloadAfter('createEmail', {}, input);
  };
  const updateEmail = (
    emailId: string,
    input: { email?: string; type?: string; isPrimary?: boolean }
  ) => reloadAfter('updateEmail', { emailId }, { id: emailId, ...input });
  const removeEmail = (emailId: string) => reloadAfter('deleteEmail', { emailId });

  const addDocument = (input: { type: string; countryIssue: string; data: string }) => {
    return reloadAfter('createDocument', {}, input);
  };
  const updateDocument = (
    documentId: string,
    input: { type?: string; countryIssue?: string; data?: string }
  ) => reloadAfter('updateDocument', { documentId }, { id: documentId, ...input });
  const removeDocument = (documentId: string) => reloadAfter('deleteDocument', { documentId });

  const addPhone = (input: {
    countryCode: string;
    localCode: string;
    number: string;
    isPrimary?: boolean;
  }) => reloadAfter('createPhone', {}, input);
  const updatePhone = (
    phoneId: string,
    input: { countryCode?: string; localCode?: string; number?: string; isPrimary?: boolean }
  ) => reloadAfter('updatePhone', { phoneId }, { id: phoneId, ...input });
  const removePhone = (phoneId: string) => reloadAfter('deletePhone', { phoneId });

  /**
   * Forgets the loaded record (JUM-781): a login as another account inside the
   * same SPA session must not keep the previous user's roles in memory, or the
   * sidebar filters by the wrong scopes until a full reload.
   */
  const reset = (): void => {
    record.value = null;
    loading.value = false;
    inflight = null;
  };

  // roles of the signed-in user: `record.value?.roles` after `load()` (JUM-772).
  return {
    record,
    loading,
    reset,
    load,
    saveScalars,
    changePassword,
    addEmail,
    updateEmail,
    removeEmail,
    addDocument,
    updateDocument,
    removeDocument,
    addPhone,
    updatePhone,
    removePhone
  };
});
