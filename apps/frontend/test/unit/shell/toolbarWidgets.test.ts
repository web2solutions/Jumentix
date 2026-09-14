import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { defineComponent } from 'vue';

import { listToolbarWidgets, registerToolbarWidget, resetToolbarWidgets } from '@/shell/toolbarWidgets';

const Dummy = defineComponent({ name: 'DummyWidget', template: '<span data-dummy />' });

describe('toolbar widget registry (JUM-798)', () => {
  beforeEach(() => {
    resetToolbarWidgets();
  });

  it('renders a module widget only while that module is active and the role has the scopes', () => {
    expect.hasAssertions();
    registerToolbarWidget({
      id: 'fixture',
      component: Dummy,
      placement: 'right',
      order: 1,
      moduleId: 'users',
      requiredScopes: ['read_user']
    });
    expect(listToolbarWidgets(['user'], 'users', 'right').map((item) => item.id)).toStrictEqual(['fixture']);
    expect(listToolbarWidgets(['user'], 'other', 'right')).toStrictEqual([]);
    expect(listToolbarWidgets(['user'], 'users', 'left')).toStrictEqual([]);
  });
});
