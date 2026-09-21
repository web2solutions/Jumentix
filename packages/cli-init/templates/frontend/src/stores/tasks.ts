import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

const STORAGE_KEY = 'jumentix-frontend-tasks';

export interface TaskSnapshot {
  open: string[];
  active: string | null;
}

const readSnapshot = (): TaskSnapshot => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { open: [], active: null };
    const parsed = JSON.parse(raw) as TaskSnapshot;
    if (!Array.isArray(parsed.open)) return { open: [], active: null };
    return {
      open: parsed.open.filter((id) => typeof id === 'string'),
      active: typeof parsed.active === 'string' ? parsed.active : null
    };
  } catch {
    return { open: [], active: null };
  }
};

const writeSnapshot = (snapshot: TaskSnapshot): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // private mode — in-memory list still works for the session
  }
};

export const useTaskStore = defineStore('tasks', () => {
  const initial = readSnapshot();
  const open = ref<string[]>([...initial.open]);
  const active = ref<string | null>(
    initial.active && initial.open.includes(initial.active)
      ? initial.active
      : (initial.open[0] ?? null)
  );

  const persist = (): void => {
    writeSnapshot({ open: open.value, active: active.value });
  };

  const openModule = (moduleId: string): void => {
    if (!open.value.includes(moduleId)) {
      open.value = [...open.value, moduleId];
    }
    active.value = moduleId;
    persist();
  };

  const activate = (moduleId: string): void => {
    if (!open.value.includes(moduleId)) return;
    active.value = moduleId;
    persist();
  };

  const close = (moduleId: string): void => {
    const index = open.value.indexOf(moduleId);
    if (index < 0) return;
    const next = open.value.filter((id) => id !== moduleId);
    open.value = next;
    if (active.value === moduleId) {
      active.value = next[index - 1] ?? next[0] ?? null;
    }
    persist();
  };

  const hydrate = (): void => {
    const snapshot = readSnapshot();
    open.value = snapshot.open;
    active.value = snapshot.active && snapshot.open.includes(snapshot.active)
      ? snapshot.active
      : (snapshot.open[0] ?? null);
  };

  const reset = (): void => {
    open.value = [];
    active.value = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return {
    open,
    active,
    isOpen: computed(() => open.value.length > 0),
    openModule,
    activate,
    close,
    hydrate,
    reset
  };
});

/** How many task buttons stay visible before the overflow menu. */
export const visibleTaskSlice = (
  ids: string[],
  maxVisible: number
): { shown: string[]; overflow: string[] } => {
  if (maxVisible < 1 || ids.length <= maxVisible) {
    return { shown: ids, overflow: [] };
  }
  return {
    shown: ids.slice(0, maxVisible),
    overflow: ids.slice(maxVisible)
  };
};
