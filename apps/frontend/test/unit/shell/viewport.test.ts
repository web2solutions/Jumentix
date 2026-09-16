import {
  afterEach, describe, expect, it
} from 'bun:test';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useShellViewport, viewportForWidth } from '@/shell/breakpoints';

/** Bounded poll on a condition — never a fixed wait (Requirement 134 §2). */
const pollUntil = async (condition: () => boolean, attempts = 200): Promise<void> => {
  for (let index = 0; index < attempts; index += 1) {
    if (condition()) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
  throw new Error('pollUntil: condition not met');
};

/** useShellViewport (JUM-799): reactive breakpoint tokens driven by window resize. */
describe('useShellViewport (JUM-799)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reacts to window resize with updated breakpoint tokens', async () => {
    expect.hasAssertions();
    let shell: ReturnType<typeof useShellViewport> | undefined;
    const Probe = defineComponent({
      setup() {
        shell = useShellViewport();
        return () => h('div');
      }
    });
    mount(Probe, { attachTo: document.body });
    expect(shell).toBeDefined();
    const viewport = shell as ReturnType<typeof useShellViewport>;

    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true, writable: true });
    window.dispatchEvent(new Event('resize'));
    await pollUntil(() => viewport.width.value === 800);

    expect(viewport.viewport.value).toBe('md');
    expect(viewport.isTablet.value).toBe(true);
    expect(viewport.isPhone.value).toBe(false);
    expect(viewport.isDesktop.value).toBe(false);

    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true, writable: true });
    window.dispatchEvent(new Event('resize'));
    await pollUntil(() => viewport.width.value === 400);
    expect(viewport.viewport.value).toBe('xs');
    expect(viewport.isPhone.value).toBe(true);
    expect(viewport.bottomSheetSwitcher.value).toBe(true);
  });

  it('maps every breakpoint boundary onto a token', () => {
    expect.hasAssertions();
    expect(viewportForWidth(1400)).toBe('xxl');
    expect(viewportForWidth(992)).toBe('lg');
    expect(viewportForWidth(576)).toBe('sm');
    expect(viewportForWidth(575)).toBe('xs');
  });
});
