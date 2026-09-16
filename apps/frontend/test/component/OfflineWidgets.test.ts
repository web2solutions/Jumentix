import {
  afterEach, describe, expect, it
} from 'bun:test';

import NotificationCenter from '@/shell/NotificationCenter.vue';
import OnlineOfflineWidget from '@/shell/OnlineOfflineWidget.vue';
import { registerShellToolbarWidgets } from '@/shell/registerShellWidgets';
import { listToolbarWidgets, resetToolbarWidgets } from '@/shell/toolbarWidgets';
import { useNotificationStore } from '@/stores/notifications';

import { flush, mountWithShell } from './support';

describe('offline toolbar widgets (JUM-807/808)', () => {
  afterEach(() => {
    resetToolbarWidgets();
    document.body.innerHTML = '';
  });

  it('registers notification and online widgets and shows unread count', async () => {
    expect.hasAssertions();
    registerShellToolbarWidgets();
    const ids = listToolbarWidgets(['superadmin'], null, 'right').map((item) => item.id);
    expect(ids).toContain('notifications');
    expect(ids).toContain('online-offline');
    const wrapper = mountWithShell(NotificationCenter);
    useNotificationStore().push({
      kind: 'info', title: 'Hello', message: 'There'
    });
    await flush(1);
    expect(wrapper.text()).toContain('Notifications');
    mountWithShell(OnlineOfflineWidget);
    expect(document.querySelector('[data-online]')).not.toBeNull();
  });
});
