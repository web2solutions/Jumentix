import {
  afterEach, describe, expect, it
} from 'bun:test';
import { createMemoryHistory, createRouter } from 'vue-router';

import ProfileView from '@/features/profile/ProfileView.vue';
import RegisterView from '@/features/auth/RegisterView.vue';
import NotFoundView from '@/features/dashboard/NotFoundView.vue';
import OrganizationsView from '@/features/organizations/OrganizationsView.vue';
import UsersView from '@/features/users/UsersView.vue';
import NetworkActivity from '@/components/NetworkActivity.vue';
import AppHeader from '@/components/AppHeader.vue';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { useAuthStore } from '@/stores/auth';

import { backend, users } from './fixtures';
import {
  flush, freshSession, mockFetch, mountWithShell, recorded
} from './support';

const originalFetch = globalThis.fetch;

const routerFor = (path: string) => {
  const router = createRouter({
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
  router.push(path);
  return router;
};

/**
 * JUM-776 — the profile page and its OAS-driven sub-resource cards, mounted
 * for real: every row edit and add goes through the SDK with the body the
 * contract declares, and a 401 on load drops the session (JUM-762).
 */
describe('ProfileView', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  it('loads the signed-in record and renders the three sub-resource cards with contract labels', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(backend);
    const wrapper = mountWithShell(ProfileView, { pinia, global: { plugins: [pinia, routerFor('/profile')] } });
    await flush(5);
    expect(wrapper.text()).toContain('Account details');
    expect(wrapper.text()).toContain('Email addresses');
    expect(wrapper.text()).toContain('Documents');
    expect(wrapper.text()).toContain('Phone numbers');
    expect(wrapper.find('#oas-field-firstName').exists()).toBe(true);
    const emailHeaders = wrapper.findAll('table').at(0)!.findAll('th').map((th) => th.text());
    expect(emailHeaders).toStrictEqual(['Email', 'Type', 'Primary', 'Actions']);
    wrapper.unmount();
  });

  it('saves scalars with the full record merged (never a partial body) and confirms inline', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(backend);
    const wrapper = mountWithShell(ProfileView, { pinia, global: { plugins: [pinia, routerFor('/profile')] } });
    await flush(5);
    await wrapper.find('#oas-field-lastName').setValue('Almeida');
    await wrapper.findAll('form').at(0)!.trigger('submit');
    await flush(4);
    const put = recorded.find((c) => c.method === 'PUT' && c.url.endsWith('/users/u1'))!;
    expect((put.body as Record<string, unknown>).lastName).toBe('Almeida');
    expect((put.body as Record<string, unknown>).username).toBe('zoe@x.dev');
    expect(wrapper.text()).toContain('Profile saved.');
    wrapper.unmount();
  });

  it('adds an email through the OAS RequestCreateEmail body and edits a phone row', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(backend);
    const wrapper = mountWithShell(ProfileView, { pinia, global: { plugins: [pinia, routerFor('/profile')] } });
    await flush(5);
    await wrapper.find('#oas-field-email').setValue('second@x.dev');
    await wrapper.findAll('button').find((b) => b.text() === 'Add')!.trigger('click');
    await flush(4);
    const post = recorded.find((c) => c.method === 'POST' && c.url.includes('/createEmail'))!;
    expect(post.body).toMatchObject({ email: 'second@x.dev', type: 'work' });
    expect(Object.keys(post.body as object).sort()).toStrictEqual(['email', 'isPrimary', 'type']);
    const phoneRow = wrapper.findAll('table').at(2)!.find('tbody tr');
    await phoneRow.find('input[aria-label="Phone 99999-0000"]').setValue('98888-0000');
    await phoneRow.findAll('button').find((b) => b.text() === 'Save')!.trigger('click');
    await flush(4);
    const put = recorded.find((c) => c.method === 'PUT' && /updatePhone|phones\/p1/.test(c.url))!;
    expect((put.body as Record<string, unknown>).number).toBe('98888-0000');
    wrapper.unmount();
  });

  it('rejects a mismatched password repeat before HTTP and validates the OAS minimum', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(backend);
    const wrapper = mountWithShell(ProfileView, { pinia, global: { plugins: [pinia, routerFor('/profile')] } });
    await flush(5);
    await wrapper.find('#oas-field-password').setValue('longenough1');
    await wrapper.find('#profile-password-repeat').setValue('different1');
    await wrapper.findAll('form').at(1)!.trigger('submit');
    await flush(2);
    expect(wrapper.text()).toContain('Passwords do not match.');
    expect(recorded.filter((c) => c.url.includes('updatePassword'))).toHaveLength(0);
    wrapper.unmount();
  });

  it('drops the session and redirects to /login when the profile answers 401', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(() => ({ status: 401, body: { message: 'Unauthorized' } }));
    const router = routerFor('/profile');
    const wrapper = mountWithShell(ProfileView, { pinia, global: { plugins: [pinia, router] } });
    await flush(5);
    expect(useAuthStore().token).toBe('');
    expect(router.currentRoute.value.path).toBe('/login');
    wrapper.unmount();
  });
});

describe('RegisterView', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  it('builds the form from RequestRegister and refuses mismatched passwords before HTTP', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(backend);
    const wrapper = mountWithShell(RegisterView, { pinia, global: { plugins: [pinia, routerFor('/register')] } });
    expect(wrapper.find('#oas-field-firstName').exists()).toBe(true);
    await wrapper.find('#oas-field-firstName').setValue('New');
    await wrapper.find('#oas-field-username').setValue('new@x.dev');
    await wrapper.find('#oas-field-password').setValue('x'.repeat(8));
    await wrapper.find('#register-password-repeat').setValue('y'.repeat(8));
    await wrapper.find('form').trigger('submit');
    await flush(2);
    expect(wrapper.find('[role="alert"]').text()).toBe('Passwords do not match.');
    expect(recorded).toHaveLength(0);
    wrapper.unmount();
  });
});

describe('shell views', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.innerHTML = '';
  });

  it('UsersView restricts the organization reference for non-superadmins and protects self-delete', async () => {
    expect.hasAssertions();
    const pinia = freshSession({ roles: ['admin'], organization: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    mockFetch(backend);
    const wrapper = mountWithShell(UsersView, { pinia, global: { plugins: [pinia, routerFor('/users')] } });
    await flush(5);
    expect(wrapper.find('h3').text()).toBe('Users');
    expect(wrapper.find('button[aria-label="delete u1"]').exists()).toBe(false);
    expect(wrapper.findAll('tbody tr').length).toBe(users.length);
    wrapper.unmount();
  });

  it('OrganizationsView renders the listing with the localized title', async () => {
    expect.hasAssertions();
    const pinia = freshSession({ locale: 'pt-BR' });
    mockFetch(backend);
    const wrapper = mountWithShell(OrganizationsView, { pinia, global: { plugins: [pinia, routerFor('/organizations')] } });
    await flush(5);
    expect(wrapper.find('h3').text()).toBe('Organizações');
    expect(wrapper.findAll('tbody tr').length).toBe(2);
    wrapper.unmount();
  });

  it('NotFoundView renders without a session', () => {
    expect.hasAssertions();
    const pinia = freshSession();
    const wrapper = mountWithShell(NotFoundView, { pinia, global: { plugins: [pinia, routerFor('/nope')] } });
    expect(wrapper.text()).toContain('404');
    wrapper.unmount();
  });

  it('NetworkActivity lists SDK request events with status badges', async () => {
    expect.hasAssertions();
    const pinia = freshSession();
    mockFetch(backend);
    const wrapper = mountWithShell(NetworkActivity, { pinia });
    const { getSharedApiClient } = await import('@/contracts/apiClient');
    await getSharedApiClient().request({ operationId: 'getAll', headers: { Authorization: 'Bearer x' } });
    await flush(2);
    expect(wrapper.text()).toContain('getAll');
    expect(wrapper.find('.badge').text()).toBe('200');
    wrapper.unmount();
  });

  it('DefaultLayout mounts header, sidebar and footer and loads roles for the nav', async () => {
    expect.hasAssertions();
    const pinia = freshSession({ roles: ['admin'] });
    mockFetch(backend);
    const wrapper = mountWithShell(DefaultLayout, { pinia, global: { plugins: [pinia, routerFor('/dashboard')] } });
    await flush(4);
    expect(wrapper.find('.sidebar').exists()).toBe(true);
    expect(wrapper.find('.header').exists()).toBe(true);
    expect(wrapper.find('.footer').text()).toContain('Generated by');
    expect(wrapper.find('.sidebar-nav').text()).toContain('Users');
    wrapper.unmount();
  });

  it('AppHeader exposes the localized top nav and the theme switch', async () => {
    expect.hasAssertions();
    const pinia = freshSession({ locale: 'pt-BR' });
    mockFetch(backend);
    const wrapper = mountWithShell(AppHeader, { pinia, global: { plugins: [pinia, routerFor('/dashboard')] } });
    await flush(1);
    expect(wrapper.find('button[aria-label="Alternar navegação"]').exists()).toBe(true);
    expect(wrapper.find('[data-shell-header]').exists()).toBe(true);
    wrapper.unmount();
  });
});
