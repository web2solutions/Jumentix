import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import router from '@/router';

/** Shell router (JUM-795): the composed guard chain admits public routes. */
describe('shell router guard chain (JUM-795)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('reaches the public login route through the composed guards', async () => {
    expect.hasAssertions();
    await router.push('/login');
    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('redirects an unauthenticated navigation to /login', async () => {
    expect.hasAssertions();
    await router.push('/dashboard');
    expect(router.currentRoute.value.path).toBe('/login');
  });
});
