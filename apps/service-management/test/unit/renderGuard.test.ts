/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * JUM-770 — designer render guard: a render pass whose signed inputs did not
 * change is skipped; any change (or an explicit invalidation) re-arms it.
 */

import { createRenderGuard, stableSerialize } from '../../src/ui/renderGuard.js';

describe('service-management render guard (JUM-770)', () => {
  it('serializes objects independent of key order', () => {
    expect.hasAssertions();
    expect(stableSerialize({ a: 1, b: { c: [1, 2], d: 'x' } }))
      .toBe(stableSerialize({ b: { d: 'x', c: [1, 2] }, a: 1 }));
    expect(stableSerialize({ a: 1 })).not.toBe(stableSerialize({ a: 2 }));
  });

  it('compacts long strings by length/head/tail and survives cycles', () => {
    expect.hasAssertions();
    const head = 'a'.repeat(40);
    const tail = 'z'.repeat(40);
    const long = head + 'm'.repeat(80) + tail;
    const serialized = stableSerialize({ file: long });
    expect(serialized).toContain(`${long.length}:`);
    expect(serialized).not.toBe(JSON.stringify({ file: long }));
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(stableSerialize(circular)).toContain('[Circular]');
  });

  it('skips the render when the signature is unchanged and re-renders on change', () => {
    expect.hasAssertions();
    const model = { domains: [] as string[], selected: null as string | null };
    const guard = createRenderGuard(() => stableSerialize(model));
    expect(guard.shouldRender()).toBe(true);
    expect(guard.shouldRender()).toBe(false);
    expect(guard.shouldRender()).toBe(false);
    model.domains.push('Users');
    expect(guard.shouldRender()).toBe(true);
    expect(guard.shouldRender()).toBe(false);
    model.selected = 'Users';
    expect(guard.shouldRender()).toBe(true);
  });

  it('re-arms after invalidate even when nothing changed', () => {
    expect.hasAssertions();
    const guard = createRenderGuard(() => stableSerialize({ a: 1 }));
    expect(guard.shouldRender()).toBe(true);
    expect(guard.shouldRender()).toBe(false);
    guard.invalidate();
    expect(guard.shouldRender()).toBe(true);
  });
});

describe('renderGuard signature edges (JUM-821)', () => {
  it('drops function and undefined values so they never gate a render', () => {
    expect.hasAssertions();

    // Callbacks and absent values are not render inputs: two states that
    // differ only in them must serialize identically, or every render would
    // look changed.
    expect(stableSerialize({ a: 1, fn: () => 2, missing: undefined }))
      .toBe(stableSerialize({ a: 1 }));
    expect(stableSerialize({ a: 1, fn: () => 999 }))
      .toBe(stableSerialize({ a: 1, fn: () => 2 }));
  });

  it('accepts a plain value as the signature source', () => {
    expect.hasAssertions();

    const guard = createRenderGuard('fixed-signature' as never);
    expect(guard.shouldRender()).toBe(true);
    expect(guard.shouldRender()).toBe(false);
    guard.invalidate();
    expect(guard.shouldRender()).toBe(true);
  });
});
