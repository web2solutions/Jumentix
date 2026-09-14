import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

export interface AppNotification {
  id: string;
  createdAt: string;
  kind: 'reject' | 'info' | 'update';
  title: string;
  message: string;
  entity?: string;
  key?: string;
  reopen?: Record<string, unknown>;
  read: boolean;
}

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([]);
  const reopenTarget = ref<AppNotification | null>(null);

  const unread = computed(() => items.value.filter((item) => !item.read).length);

  const push = (input: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification => {
    const notification: AppNotification = {
      ...input,
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `n-${Date.now()}`,
      createdAt: new Date().toISOString(),
      read: false
    };
    items.value = [notification, ...items.value].slice(0, 50);
    return notification;
  };

  const reject = (input: {
    entity: string;
    key: string;
    kind: string;
    message: string;
    reopen?: Record<string, unknown>;
  }): AppNotification => push({
    kind: 'reject',
    title: input.entity,
    message: input.message,
    entity: input.entity,
    key: input.key,
    reopen: input.reopen
  });

  const markRead = (id: string): void => {
    items.value = items.value.map((item) => (
      item.id === id ? { ...item, read: true } : item
    ));
  };

  const markAllRead = (): void => {
    items.value = items.value.map((item) => ({ ...item, read: true }));
  };

  const takeReopen = (id: string): Record<string, unknown> | undefined => {
    const found = items.value.find((item) => item.id === id);
    if (!found?.reopen) return undefined;
    reopenTarget.value = found;
    markRead(id);
    return found.reopen;
  };

  const clearReopen = (): void => {
    reopenTarget.value = null;
  };

  return {
    items, unread, reopenTarget, push, reject, markRead, markAllRead, takeReopen, clearReopen
  };
});
