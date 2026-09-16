/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * JUM-770 — the process-help popover is tracked by process key outside the
 * DOM so it can be re-opened after every WebSocket-driven table rebuild.
 */

import { createHelpPopoverState, resolveOpenHelpKey } from '../../src/ui/helpPopoverState.js';

describe('service-management help popover state (JUM-770)', () => {
  it('toggles a key open and closed, replacing any previously open key', () => {
    expect.hasAssertions();
    const state = createHelpPopoverState();
    expect(state.current()).toBeNull();
    expect(state.toggle('default::api')).toBe('default::api');
    expect(state.isOpen('default::api')).toBe(true);
    expect(state.toggle('default::worker')).toBe('default::worker');
    expect(state.isOpen('default::api')).toBe(false);
    expect(state.isOpen('default::worker')).toBe(true);
    expect(state.toggle('default::worker')).toBeNull();
    expect(state.current()).toBeNull();
  });

  it('closes explicitly and reports open state per key', () => {
    expect.hasAssertions();
    const state = createHelpPopoverState();
    state.open('default::api');
    expect(state.current()).toBe('default::api');
    state.close();
    expect(state.current()).toBeNull();
    expect(state.isOpen('default::api')).toBe(false);
  });

  it('re-applies the tracked key after a re-render only while its row is visible', () => {
    expect.hasAssertions();
    const visible = ['default::api', 'default::worker'];
    expect(resolveOpenHelpKey('default::api', visible)).toBe('default::api');
    // A filter change removed the row: nothing to re-open.
    expect(resolveOpenHelpKey('default::grpc', visible)).toBeNull();
    expect(resolveOpenHelpKey(null, visible)).toBeNull();
    expect(resolveOpenHelpKey('default::api', new Set(visible))).toBe('default::api');
    expect(resolveOpenHelpKey('default::api', [])).toBeNull();
  });
});
