import {
  afterEach, describe, expect, it
} from 'bun:test';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

import AppHeaderDropdownAccnt from '@/components/AppHeaderDropdownAccnt.vue';
import AppSidebarNav from '@/components/AppSidebarNav.vue';
import DashboardView from '@/features/dashboard/DashboardView.vue';
import LoginView from '@/features/auth/LoginView.vue';
import { setLocale } from '@/i18n';
import { useAuthStore } from '@/stores/auth';

import { backend } from './fixtures';
import {
  flush, freshSession, mockFetch, mountWithShell, recorded
} from './support';

const originalFetch = globalThis.fetch;

const makeRouter = (): Router => createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
    { path: '/dashboard', component: { template: '<div />' } },
    { path: '/profile', component: { template: '<div />' } },
    { path: '/users', component: { template: '<div />' } },
    { path: '/organizations', component: { template: '<div />' } }
  ]
});

/**
 * JUM-776/781 — the shell around X-CRUD: login submits the OAS body through
 * the SDK and lands on the dashboard; the dashboard shows server totals or an
 * honest "no access"; the account menu carries only real entries and the
 * locale switch; the sidebar filters by RBAC and translates.
 */
describe('LoginView', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  it('builds the form from RequestLogin, submits the collected body and navigates to /dashboard', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    useAuthStore().token = '';
    mockFetch(backend);
    const router = makeRouter();
    await router.push('/login');
    const wrapper = mountWithShell(LoginView, { pinia, global: { plugins: [pinia, router] } });
    expect(wrapper.find('label[for="oas-field-username"]').text()).toBe('Username *');
    expect(wrapper.find('#oas-field-schemaType').exists()).toBe(false); // x-hide
    await wrapper.find('#oas-field-username').setValue('zoe@x.dev');
    await wrapper.find('#oas-field-password').setValue('secret123');
    await wrapper.find('form').trigger('submit');
    await flush(4);
    const login = recorded.find((c) => c.url.endsWith('/auth/login'));
    expect(login?.body).toStrictEqual({ username: 'zoe@x.dev', password: 'secret123' });
    expect(router.currentRoute.value.path).toBe('/dashboard');
    expect(useAuthStore().userId).toBe('u1');
    wrapper.unmount();
  });

  it('shows the contract validation message before any HTTP call', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(backend);
    const router = makeRouter();
    const wrapper = mountWithShell(LoginView, { pinia, global: { plugins: [pinia, router] } });
    await wrapper.find('form').trigger('submit');
    await flush(1);
    expect(wrapper.find('[role="alert"]').text()).toBe('Username is required.');
    expect(recorded).toHaveLength(0);
    wrapper.unmount();
  });
});

describe('DashboardView', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  it('shows real totals from the list envelopes and no template mock data', async () => {
    expect.hasAssertions();
    const pinia = freshSession({ roles: ['superadmin'] });
    mockFetch(backend);
    const wrapper = mountWithShell(DashboardView, {
      pinia, global: { plugins: [pinia, makeRouter()] }
    });
    await flush(5);
    expect(wrapper.find('[data-metric="users"]').text()).toContain('3');
    expect(wrapper.find('[data-metric="organizations"]').text()).toContain('2');
    expect(wrapper.text()).toContain('Welcome, Zoe Lima');
    expect(wrapper.text()).not.toContain('Traffic');
    expect(wrapper.text()).not.toContain('Yiorgos');
    const sizes = recorded.filter((c) => c.method === 'GET').map((c) => new URL(c.url).searchParams.get('size'));
    expect(sizes).toStrictEqual(['1', '1']);
    wrapper.unmount();
  });

  it('renders an honest "no access" for a role without read scope', async () => {
    expect.hasAssertions();
    const pinia = freshSession({ roles: ['user'] });
    mockFetch(backend);
    const wrapper = mountWithShell(DashboardView, {
      pinia, global: { plugins: [pinia, makeRouter()] }
    });
    await flush(5);
    expect(wrapper.find('[data-metric="organizations"]').text()).toContain('Your role has no read access');
    expect(recorded.filter((c) => c.url.includes('/organizations'))).toHaveLength(0);
    wrapper.unmount();
  });
});

describe('AppHeaderDropdownAccnt', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists only Profile, the locales and Logout — no template placeholders', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    const wrapper = mountWithShell(AppHeaderDropdownAccnt, {
      pinia, global: { plugins: [pinia, makeRouter()] }
    });
    const items = wrapper.findAll('.dropdown-item').map((i) => i.text());
    expect(items).toStrictEqual(['Profile', 'English', 'Português (BR)', 'Logout']);
    expect(wrapper.text()).not.toContain('Payments');
    expect(wrapper.text()).not.toContain('42');
    expect(wrapper.find('.avatar').text()).toBe('ZL');
    await wrapper.findAll('.dropdown-item').find((i) => i.text() === 'Português (BR)')!.trigger('click');
    await flush(1);
    expect(wrapper.findAll('.dropdown-item').map((i) => i.text())).toContain('Sair');
    setLocale('en');
    wrapper.unmount();
  });
});

describe('AppSidebarNav', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the group only for roles that can read it and translates labels', async () => {
    expect.hasAssertions();
    const admin = freshSession({ roles: ['admin'] });
    const asAdmin = mountWithShell(AppSidebarNav, {
      pinia: admin, global: { plugins: [admin, makeRouter()] }
    });
    const adminLinks = asAdmin.findAll('.nav-link, .nav-group-toggle').map((a) => a.text().trim());
    expect(adminLinks).toContain('Dashboard');
    expect(adminLinks).toContain('Users');
    expect(adminLinks).toContain('Organizations');
    asAdmin.unmount();

    const user = freshSession({ roles: ['user'], locale: 'pt-BR' });
    const asUser = mountWithShell(AppSidebarNav, {
      pinia: user, global: { plugins: [user, makeRouter()] }
    });
    const userLinks = asUser.findAll('.nav-link, .nav-group-toggle').map((a) => a.text().trim());
    expect(userLinks).toContain('Painel');
    expect(userLinks).toContain('Usuários');
    expect(userLinks).not.toContain('Organizações');
    asUser.unmount();
    setLocale('en');
  });
});
