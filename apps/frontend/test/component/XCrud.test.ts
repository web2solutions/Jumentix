import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';

import XCrud from '@/components/x-crud/XCrud.vue';
import type { XCrudEntityConfig } from '@/components/x-crud/xCrudTypes';
import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import { organizationsCrudConfig } from '@/features/organizations/organizationsCrudConfig';
import { setLocale } from '@/i18n';

import { backend, users } from './fixtures';
import {
  flush, freshSession, mockFetch, mountWithShell, recorded
} from './support';

const originalFetch = globalThis.fetch;

const mountUsers = async (roles = ['superadmin'], config: XCrudEntityConfig = usersCrudConfig) => {
  const pinia = freshSession({ roles, organization: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
  mockFetch(backend);
  // Same guard UsersView passes: nobody deletes their own account.
  const canDeleteRow = (row: Record<string, unknown>) => String(row.id) !== 'u1';
  const wrapper = mountWithShell(XCrud, {
    props: { config: { ...config, debounceMs: 0 }, canDeleteRow },
    pinia
  });
  await flush(4);
  return wrapper;
};

/**
 * JUM-776 — the X-CRUD kit mounted for real (CoreUI plugin, shipped
 * components, happy-dom). Each test asserts rendered DOM or the wire, never
 * only that a function was called (Requirement 135 §1).
 */
describe('XCrud listing (Users)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders one row per record of the page with contract labels as headers', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    const headers = wrapper.findAll('thead tr:first-child th').map((th) => th.text().replace(/\s+/g, ' ').trim());
    expect(headers).toContain('First name');
    expect(headers).toContain('Username');
    expect(headers.at(-1)).toBe('Actions');
    expect(wrapper.findAll('tbody tr').length).toBe(users.length);
    expect(wrapper.find('tbody').text()).toContain('zoe@x.dev');
    wrapper.unmount();
  });

  it('shows sort arrows only for sortable columns and requests sort from the server', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    const header = (label: string) => wrapper.findAll('thead tr:first-child th')
      .find((th) => th.text().startsWith(label))!;
    expect(header('First name').classes()).toContain('xcrud-sortable');
    expect(header('Emails').classes()).not.toContain('xcrud-sortable');
    await header('First name').trigger('click');
    await flush(4);
    const last = recorded.filter((c) => c.method === 'GET' && c.url.includes('/users?')).at(-1)!;
    expect(new URL(last.url).searchParams.get('sort')).toBe('firstName:asc');
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('Abraham');
    expect(header('First name').attributes('aria-sort')).toBe('ascending');
    wrapper.unmount();
  });

  it('opens the filter row from the toolbar button, only for filterable columns, and sends contains', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    expect(wrapper.find('.xcrud-filter-row').exists()).toBe(false);
    const button = wrapper.find('button[aria-label="toggle column filters"]');
    expect(button.text()).toContain('Filters');
    await button.trigger('click');
    expect(wrapper.find('.xcrud-filter-row').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="filter-firstName"]').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="filter-emails"]').exists()).toBe(false);
    expect(wrapper.find('input[aria-label="filter-createdAt-from"]').exists()).toBe(true);
    await wrapper.find('input[aria-label="filter-firstName"]').setValue('zo');
    await flush(4);
    const last = recorded.filter((c) => c.method === 'GET' && c.url.includes('/users?')).at(-1)!;
    const filter = JSON.parse(atob(new URL(last.url).searchParams.get('filter')!));
    expect(filter).toStrictEqual({ firstName: { operator: 'contains', value: 'zo' } });
    expect(button.text()).toContain('(1)');
    wrapper.unmount();
  });

  it('keeps the actions column sticky and resolves the organization label in cells', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    const actions = wrapper.find('tbody td.xcrud-actions-col');
    expect(actions.classes()).toContain('xcrud-sticky-end');
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('ACME');
    expect(wrapper.findAll('tbody tr')[0].text()).not.toContain('a0eebc99');
    wrapper.unmount();
  });

  it('paginates through the footer and reports "x–y of N" from the server total', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers(['superadmin'], { ...usersCrudConfig, pageSize: 2 });
    expect(wrapper.find('.xcrud-footer span').text()).toBe('1–2 of 3');
    expect(wrapper.findAll('tbody tr').length).toBe(2);
    await wrapper.find('button[aria-label="Next"]').trigger('click');
    await flush(4);
    expect(wrapper.find('.xcrud-footer span').text()).toBe('3–3 of 3');
    expect(wrapper.findAll('tbody tr').length).toBe(1);
    wrapper.unmount();
  });

  it('hides delete for the signed-in user and for roles without the scope', async () => {
    expect.hasAssertions();
    const asSuperadmin = await mountUsers();
    expect(asSuperadmin.find('button[aria-label="delete u1"]').exists()).toBe(false);
    expect(asSuperadmin.find('button[aria-label="delete u2"]').exists()).toBe(true);
    asSuperadmin.unmount();
    const asUser = await mountUsers(['user']);
    expect(asUser.find('button[aria-label="delete u2"]').exists()).toBe(false);
    expect(asUser.find('.card-header').text()).not.toContain('New User');
    asUser.unmount();
  });

  it('opens the row detail with one tab per object array and formatted timestamps', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    await wrapper.find('button[aria-label="preview u1"]').trigger('click');
    await flush(2);
    const tabs = wrapper.findAll('.xcrud-row-detail .nav-link').map((a) => a.text());
    expect(tabs).toStrictEqual(['User Data', 'Emails', 'Phones', 'Edit User']);
    const detail = wrapper.find('.xcrud-row-detail').text();
    expect(detail).not.toContain('2026-09-13T00:00:17.166Z');
    expect(detail).toContain('ACME');
    wrapper.unmount();
  });

  it('edit form shows the referenced organization label, not its uuid, and help text under fields', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    await wrapper.find('button[aria-label="edit u2"]').trigger('click');
    await flush(3);
    const fk = wrapper.find('#xref-organization').element as HTMLInputElement;
    expect(fk.value).toBe('ACME');
    expect(wrapper.find('.xcrud-row-detail').text()).not.toContain('a0eebc99');
    expect(wrapper.find('.xcrud-row-detail .form-text').text()).toBe('User\'s first name');
    wrapper.unmount();
  });

  it('create form labels array editor items from the item schema and submits mapped emails', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    await wrapper.findAll('.card-header .nav-link').find((a) => a.text() === 'New User')!.trigger('click');
    await flush(1);
    await wrapper.find('button[aria-label="add documents"]').trigger('click');
    const labels = wrapper.findAll('.xcrud-array-editor label').map((l) => l.text().replace('*', '').trim());
    expect(labels).toContain('Type');
    expect(labels).toContain('Number');
    await wrapper.find('#oas-field-firstName').setValue('New');
    await wrapper.find('#oas-field-username').setValue('new@x.dev');
    await wrapper.find('#oas-field-password').setValue('x'.repeat(8));
    await wrapper.find('#oas-field-primaryEmail').setValue('new@x.dev');
    await wrapper.find('button[aria-label="Remove documents 0"]').trigger('click');
    await wrapper.findAll('button').find((b) => b.text().includes('Create'))!.trigger('click');
    await flush(4);
    const post = recorded.find((c) => c.method === 'POST')!;
    expect((post.body as Record<string, unknown>).emails).toStrictEqual([{ email: 'new@x.dev', type: 'work', isPrimary: true }]);
    wrapper.unmount();
  });

  it('renders the whole listing in Portuguese when the locale switches', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers();
    setLocale('pt-BR');
    await flush(1);
    expect(wrapper.find('.card-header').text()).toContain('Listagem de Usuário');
    expect(wrapper.find('button[aria-label="toggle column filters"]').text()).toContain('Filtros');
    expect(wrapper.findAll('thead tr:first-child th').map((th) => th.text().trim())).toContain('Nome');
    wrapper.unmount();
  });
});

describe('XCrud listing (Organizations)', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows member usernames in the members column and in the detail, never raw ids', async () => {
    expect.hasAssertions();
    const wrapper = await mountUsers(['superadmin'], organizationsCrudConfig);
    const acme = wrapper.findAll('tbody tr')[0];
    expect(acme.text()).toContain('zoe@x.dev');
    expect(acme.text()).not.toContain('u1');
    await wrapper.find('button[aria-label="preview a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"]').trigger('click');
    await flush(2);
    const detail = wrapper.find('.xcrud-row-detail').text();
    expect(detail).toContain('abe@x.dev');
    expect(detail).not.toMatch(/\bu2\b/);
    wrapper.unmount();
  });
});
