import { describe, expect, it } from 'bun:test';

import { viewportForWidth } from '@/shell/breakpoints';

describe('shell breakpoints (JUM-799)', () => {
  it('maps widths onto phone / tablet / desktop tokens', () => {
    expect.hasAssertions();
    expect(viewportForWidth(375)).toBe('xs');
    expect(viewportForWidth(768)).toBe('md');
    expect(viewportForWidth(1280)).toBe('xl');
  });
});
