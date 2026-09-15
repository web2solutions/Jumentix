import { describe, expect, it } from 'bun:test';

import { toolbarWidgets } from '@/shell/toolbarWidgets';

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

/**
 * Application bootstrap (JUM-795/802): importing `@/main` wires the OAS
 * operations, the shell widgets, Pinia, the router, CoreUI, the icon registry,
 * the session guard and the Cana boot, then mounts the app on #app.
 */
describe('application bootstrap (main.ts, JUM-795/802)', () => {
  it('boots Cana, exposes the test hooks and mounts the app', async () => {
    expect.hasAssertions();
    document.body.innerHTML = '<div id="app"></div>';
    await import('@/main');

    const hook = window as Window & {
      __jumentixWipeCana?: () => Promise<void>;
      __jumentixObjectStores?: () => string[];
    };
    expect(typeof hook.__jumentixWipeCana).toBe('function');
    expect(hook.__jumentixObjectStores?.()).toContain('users');
    expect(toolbarWidgets().map((widget) => widget.id)).toContain('notifications');

    const { canaBootStatus } = await import('@/data/db');
    expect(canaBootStatus()).toBe('ok');

    const appElement = document.querySelector('#app');
    await pollUntil(() => (appElement?.innerHTML.length ?? 0) > 0);
    expect((appElement as Element).innerHTML.length).toBeGreaterThan(0);
  });
});
