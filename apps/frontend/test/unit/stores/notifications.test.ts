import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useNotificationStore } from '@/stores/notifications';

/** Notification center store (JUM-807): read state and reopen flow. */
describe('notification store (JUM-807)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('marks one notification and all notifications as read', () => {
    expect.hasAssertions();
    const store = useNotificationStore();
    const first = store.push({ kind: 'info', title: 'One', message: 'first' });
    store.push({ kind: 'info', title: 'Two', message: 'second' });
    expect(store.unread).toBe(2);
    store.markRead(first.id);
    expect(store.unread).toBe(1);
    expect(store.items.find((item) => item.id === first.id)?.read).toBe(true);
    store.markAllRead();
    expect(store.unread).toBe(0);
  });

  it('takes the reopen payload once and clears the reopen target', () => {
    expect.hasAssertions();
    const store = useNotificationStore();
    const rejected = store.reject({
      entity: 'User',
      key: 'u1',
      kind: 'create',
      message: 'duplicate username',
      reopen: { firstName: 'Ana', username: 'ana@x.dev' }
    });
    expect(rejected.kind).toBe('reject');
    const reopen = store.takeReopen(rejected.id);
    expect({ ...reopen }).toStrictEqual({ firstName: 'Ana', username: 'ana@x.dev' });
    expect(store.reopenTarget?.id).toBe(rejected.id);
    expect(store.items.find((item) => item.id === rejected.id)?.read).toBe(true);
    store.clearReopen();
    expect(store.reopenTarget).toBeNull();
  });

  it('returns undefined for notifications without a reopen payload', () => {
    expect.hasAssertions();
    const store = useNotificationStore();
    const info = store.push({ kind: 'info', title: 'Plain', message: 'no payload' });
    expect(store.takeReopen(info.id)).toBeUndefined();
    expect(store.takeReopen('missing-id')).toBeUndefined();
  });
});
