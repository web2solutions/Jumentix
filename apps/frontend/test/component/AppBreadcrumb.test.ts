import {
  afterEach, describe, expect, it
} from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import AppBreadcrumb from '@/components/AppBreadcrumb.vue';
import '@/modules/index';

import { flush, freshSession, mountWithShell } from './support';

/**
 * JUM-906: the breadcrumb read `route.matched[].path`, which is the route
 * pattern — a module page showed "Home / Home" and linked to
 * `/#/m/:moduleId/:tab?`.
 */
const routes = [
  {
    path: '/',
    name: 'Home',
    component: { template: '<router-view />' },
    meta: { titleKey: 'nav.home' },
    children: [
      {
        path: '/m/:moduleId/:tab?', name: 'Module', component: { template: '<div />' }, meta: { titleKey: 'nav.home' }
      }
    ]
  }
];

async function crumbsAt(path: string) {
  const pinia = freshSession();
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push(path);
  const wrapper = mountWithShell(AppBreadcrumb, { pinia, global: { plugins: [pinia, router] } });
  await flush(2);
  const items = wrapper.findAll('.breadcrumb-item').map((item) => ({
    text: item.text(),
    href: item.find('a').exists() ? item.find('a').attributes('href') : ''
  }));
  wrapper.unmount();
  return items;
}

describe('AppBreadcrumb (JUM-906)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('names the module and the active tab instead of repeating Home', async () => {
    expect.hasAssertions();
    const items = await crumbsAt('/m/users/dashboard');

    expect(items.map((item) => item.text)).toStrictEqual(['Home', 'Users', 'Dashboard']);
  });

  it('links to resolved locations, never to a route pattern', async () => {
    expect.hasAssertions();
    const items = await crumbsAt('/m/users/organizations');

    expect(items.map((item) => item.text)).toStrictEqual(['Home', 'Users', 'Organizations']);
    expect(items.some((item) => item.href.includes(':moduleId'))).toBe(false);
    expect(items[1].href).toBe('/m/users');
  });
});
