import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { defineComponent, h } from 'vue';

import { useXCrud, type XCrud } from '@/components/x-crud/useXCrud';
import { resetSharedApiClient } from '@/contracts/apiClient';
import {
  closeCana, getCanaClient, openCana, wipeCanaDatabase
} from '@/data/db';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import { setLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';

const DB = 'jumentix-frontend-test-xcrud-offline';

/** Bounded poll on a condition — never a fixed wait (Requirement 134 §2). */
const pollUntil = async (condition: () => boolean, attempts = 200): Promise<void> => {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  throw new Error('pollUntil: condition not met');
};

/**
 * useXCrud with the local client open (JUM-804/809): references resolve from
 * Cana and local writes refresh the grid through the Cana subscription.
 */
describe('useXCrud with Cana open (JUM-804/809)', () => {
  const originalFetch = globalThis.fetch;
  let pinia: Pinia;

  beforeEach(async () => {
    setLocale('en');
    resetSharedApiClient();
    pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.token = 'Bearer session-token';
    auth.userId = 'u1';
    await openCana(DB);
    await wipeCanaDatabase();
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        result: [], page: 1, size: 30, total: 0
      }),
      text: async () => ''
    })) as unknown as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await closeCana();
  });

  it('resolves reference labels from the local repository', async () => {
    expect.hasAssertions();
    await getCanaClient().table('organizations').put({ id: 'org-1', name: 'ACME' });
    const crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
    await crud.loadReferences();
    expect(crud.referenceLabel('organization', 'org-1')).toBe('ACME');
  });

  it('lists rows from Cana in server mode and reloads on local writes', async () => {
    expect.hasAssertions();
    let crud: XCrud | undefined;
    const Probe = defineComponent({
      setup() {
        crud = useXCrud({ ...usersCrudConfig, debounceMs: 0 });
        return () => h('div');
      }
    });
    const wrapper = mount(Probe, { global: { plugins: [pinia] } });
    expect(crud).toBeDefined();
    const instance = crud as XCrud;

    await instance.load();
    expect(instance.rows.value).toHaveLength(0);

    await getCanaClient().table('users').put({
      id: 'u-local', firstName: 'Local', username: 'local@x.dev', updatedAt: '2026-01-01T00:00:00.000Z'
    });
    await pollUntil(() => instance.rows.value.length === 1);
    expect(instance.rows.value[0].username).toBe('local@x.dev');

    wrapper.unmount();
    await getCanaClient().table('users').put({
      id: 'u-after', firstName: 'After', username: 'after@x.dev', updatedAt: '2026-01-02T00:00:00.000Z'
    });
    for (let index = 0; index < 5; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    expect(instance.rows.value).toHaveLength(1);
  });
});
