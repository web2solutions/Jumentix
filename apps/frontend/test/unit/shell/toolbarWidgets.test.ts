import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { defineComponent } from 'vue';

import {
  listToolbarWidgets,
  registerToolbarWidget,
  resetToolbarWidgets,
  unregisterToolbarWidget
} from '@/shell/toolbarWidgets';

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

  it('replaces a widget registered twice with the same id', () => {
    expect.hasAssertions();
    registerToolbarWidget({
      id: 'fixture', component: Dummy, placement: 'left', order: 1
    });
    registerToolbarWidget({
      id: 'fixture', component: Dummy, placement: 'right', order: 5
    });
    const listed = listToolbarWidgets([], null, 'right');
    expect(listed).toHaveLength(1);
    expect(listed[0].order).toBe(5);
    expect(listToolbarWidgets([], null, 'left')).toStrictEqual([]);
  });

  it('unregisters a widget by id', () => {
    expect.hasAssertions();
    registerToolbarWidget({
      id: 'fixture', component: Dummy, placement: 'right', order: 1
    });
    unregisterToolbarWidget('fixture');
    expect(listToolbarWidgets([], null, 'right')).toStrictEqual([]);
    expect(() => unregisterToolbarWidget('missing')).not.toThrow();
  });
});
