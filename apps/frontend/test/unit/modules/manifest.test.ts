import {
  afterEach, beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { usersCrudConfig } from '@/features/users/usersCrudConfig';
import {
  canOpenModule,
  configureModules,
  firstAllowedTab,
  moduleRequiredScopes,
  registerModule,
  resetModules,
  validateModules
} from '@/modules/manifest';
import { usersModule } from '@/modules/users';

describe('module manifest (JUM-795)', () => {
  beforeEach(() => {
    resetModules();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    resetModules();
    registerModule(usersModule);
  });

  it('fails boot when a referenced operationId is absent from the OAS', () => {
    expect.hasAssertions();
    registerModule({
      ...usersModule,
      id: 'broken',
      entities: [{
        id: 'ghost',
        title: 'Ghost',
        config: {
          ...usersCrudConfig,
          operations: { ...usersCrudConfig.operations, list: 'notARealOperation' }
        },
        load: () => import('@/features/users/UsersView.vue')
      }]
    });
    expect(validateModules()).toContain('broken → "notARealOperation"');
    expect(() => configureModules()).toThrow(/notARealOperation/);
  });

  it('opens the Users module for the user role (users list) and hides it without scopes', () => {
    expect.hasAssertions();
    registerModule(usersModule);
    expect(canOpenModule(usersModule, ['user'])).toBe(true);
    expect(canOpenModule(usersModule, [])).toBe(false);
    expect(validateModules()).toStrictEqual([]);
  });

  it('rejects a duplicate module registration', () => {
    expect.hasAssertions();
    registerModule(usersModule);
    expect(() => registerModule(usersModule)).toThrow('module "users" is already registered');
  });

  it('derives the required scopes from the entity list operations', () => {
    expect.hasAssertions();
    const scopes = moduleRequiredScopes(usersModule);
    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes).toContain('read_user');
  });

  it('picks the first allowed entity tab and falls back to dashboard', () => {
    expect.hasAssertions();
    expect(firstAllowedTab(usersModule, ['admin'])).toBe('users');
    expect(firstAllowedTab(usersModule, [])).toBe('dashboard');
  });
});
