import {
  afterEach, describe, expect, it
} from 'bun:test';
import { defineComponent } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import ModuleLayout from '@/components/ModuleLayout.vue';
import '@/modules/index';

import { backend } from './fixtures';
import {
  flush, freshSession, mockFetch, mountWithShell
} from './support';

describe('ModuleLayout (JUM-797)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders entity tabs from the Users manifest and hides Organizations for the user role', async () => {
    expect.hasAssertions();
    const pinia = freshSession({ roles: ['user'] });
    mockFetch(backend);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/m/:moduleId/:tab?', component: { template: '<div />' } }]
    });
    await router.push('/m/users/users');
    const wrapper = mountWithShell(ModuleLayout, {
      pinia,
      props: { moduleId: 'users' },
      global: { plugins: [pinia, router] }
    });
    await flush(4);
    const labels = wrapper.findAll('[data-module-tabs] .nav-link').map((link) => link.text());
    expect(labels).toContain('Users');
    expect(labels).toContain('Dashboard');
    expect(labels).not.toContain('Organizations');
    wrapper.unmount();
  });
});

describe('keep-alive module panes (JUM-796)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps typed input when switching panes with v-show', async () => {
    expect.hasAssertions();
    const Host = defineComponent({
      data: () => ({ open: ['users', 'orgs'], active: 'users' }),
      template: `
        <div>
          <input v-for="id in open" v-show="id === active" :key="id" :data-pane="id" />
          <button data-to-orgs type="button" @click="active = 'orgs'" />
          <button data-to-users type="button" @click="active = 'users'" />
        </div>
      `
    });
    const pinia = freshSession();
    const wrapper = mountWithShell(Host, { pinia, global: { plugins: [pinia] } });
    await wrapper.find('[data-pane="users"]').setValue('still-here');
    await wrapper.find('[data-to-orgs]').trigger('click');
    await wrapper.find('[data-to-users]').trigger('click');
    expect((wrapper.find('[data-pane="users"]').element as HTMLInputElement).value).toBe('still-here');
    wrapper.unmount();
  });
});
