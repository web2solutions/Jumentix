import {
  beforeEach, describe, expect, it, mock
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { expireIfStaleSession, handleSdkEvent } from '@/contracts/sessionGuard';
import { useAuthStore } from '@/stores/auth';

const makeJwt = (expSeconds: number): string => {
  const payload = Buffer.from(JSON.stringify({ id: 'u1', username: 'a@b.c', exp: expSeconds }))
    .toString('base64url');
  return `x.${payload}.y`;
};

/** Session expiry: any page must react, not only /profile (JUM-773 follow-up). */
describe('sessionGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('401 on a non-auth operation expires the session and redirects', () => {
    expect.assertions(3);
    const expire = mock(() => {});
    const redirect = mock(() => {});
    const acted = handleSdkEvent(
      { type: 'request:error', status: 401, operationId: 'getOneById' },
      expire,
      redirect
    );
    expect(acted).toBe(true);
    expect(expire).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('401 on login/register is a wrong password, not an expired session', () => {
    expect.assertions(3);
    const expire = mock(() => {});
    const redirect = mock(() => {});
    const acted = handleSdkEvent(
      { type: 'request:error', status: 401, operationId: 'login' },
      expire,
      redirect
    );
    expect(acted).toBe(false);
    expect(expire).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('non-401 errors and successes never expire the session', () => {
    expect.assertions(2);
    expect(handleSdkEvent({ type: 'request:error', status: 500, operationId: 'getAll' }, () => {}, () => {})).toBe(false);
    expect(handleSdkEvent({ type: 'request:success', status: 200, operationId: 'getAll' }, () => {}, () => {})).toBe(false);
  });

  it('expireIfStaleSession expires a session whose JWT exp already passed', () => {
    expect.assertions(3);
    const auth = useAuthStore();
    auth.token = `Bearer ${makeJwt(Math.floor(Date.now() / 1000) - 60)}`;
    expect(auth.isAuthenticated()).toBe(true);
    expect(expireIfStaleSession(auth)).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('expireIfStaleSession keeps a live session and ignores empty ones', () => {
    expect.assertions(2);
    const auth = useAuthStore();
    auth.token = `Bearer ${makeJwt(Math.floor(Date.now() / 1000) + 3600)}`;
    expect(expireIfStaleSession(auth)).toBe(false);
    auth.expire();
    expect(expireIfStaleSession(auth)).toBe(false);
  });
});
