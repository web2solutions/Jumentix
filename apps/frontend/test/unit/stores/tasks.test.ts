import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useTaskStore, visibleTaskSlice } from '@/stores/tasks';

describe('task store (JUM-796)', () => {
  beforeEach(() => {
    globalThis.sessionStorage?.clear();
    setActivePinia(createPinia());
  });

  it('opens once per module, activates an existing task, and closes back to the previous', () => {
    expect.hasAssertions();
    const tasks = useTaskStore();
    tasks.openModule('users');
    tasks.openModule('users');
    expect([...tasks.open]).toEqual(['users']);
    tasks.openModule('billing');
    expect(tasks.open.join(',')).toBe('users,billing');
    expect(tasks.active).toBe('billing');
    tasks.close('billing');
    expect(tasks.active).toBe('users');
    expect(JSON.parse(sessionStorage.getItem('jumentix-frontend-tasks') ?? '{}')).toEqual({
      open: ['users'],
      active: 'users'
    });
  });

  it('hydrates the taskbar from sessionStorage', () => {
    expect.hasAssertions();
    sessionStorage.setItem('jumentix-frontend-tasks', JSON.stringify({
      open: ['users', 'billing'],
      active: 'billing'
    }));
    const tasks = useTaskStore();
    tasks.hydrate();
    expect(tasks.open.join(',')).toBe('users,billing');
    expect(tasks.active).toBe('billing');
  });

  it('overflows task buttons past the visible slot count', () => {
    expect.hasAssertions();
    expect(visibleTaskSlice(['a', 'b', 'c'], 2)).toStrictEqual({
      shown: ['a', 'b'],
      overflow: ['c']
    });
  });

  it('activates an open module and ignores unknown ones', () => {
    expect.hasAssertions();
    const tasks = useTaskStore();
    tasks.openModule('users');
    tasks.openModule('billing');
    tasks.activate('users');
    expect(tasks.active).toBe('users');
    tasks.activate('ghost');
    expect(tasks.active).toBe('users');
  });

  it('resets the taskbar and clears the persisted snapshot', () => {
    expect.hasAssertions();
    const tasks = useTaskStore();
    tasks.openModule('users');
    tasks.reset();
    expect([...tasks.open]).toStrictEqual([]);
    expect(tasks.active).toBeNull();
    expect(sessionStorage.getItem('jumentix-frontend-tasks')).toBeNull();
  });

  it('recovers from a corrupt snapshot in sessionStorage', () => {
    expect.hasAssertions();
    sessionStorage.setItem('jumentix-frontend-tasks', '{not json');
    const tasks = useTaskStore();
    tasks.hydrate();
    expect([...tasks.open]).toStrictEqual([]);
    expect(tasks.active).toBeNull();
  });
});
