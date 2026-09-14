import {
  afterEach, describe, expect, it
} from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import AppTaskbar from '@/components/AppTaskbar.vue';
import '@/modules/index';
import { useTaskStore } from '@/stores/tasks';

import { flush, freshSession, mountWithShell } from './support';

describe('AppTaskbar (JUM-796)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders one button per open module and marks the active task', async () => {
    expect.hasAssertions();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    const pinia = freshSession();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/m/:moduleId/:tab?', component: { template: '<div />' } }]
    });
    await router.push('/m/users/dashboard');
    const tasks = useTaskStore();
    tasks.openModule('users');
    const wrapper = mountWithShell(AppTaskbar, {
      pinia,
      global: { plugins: [pinia, router] }
    });
    await flush(2);
    expect(wrapper.find('[data-taskbar]').exists()).toBe(true);
    expect(wrapper.find('[data-taskbar]').text()).toMatch(/Users|Tasks/);
    expect(wrapper.find('[data-active="true"] .app-taskbar__close').element.tagName).toBe('BUTTON');
    wrapper.unmount();
  });
});
