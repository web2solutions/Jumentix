import {
  beforeEach, describe, expect, it
} from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

import { useSidebarStore } from '@/stores/sidebar';
import { useThemeStore } from '@/stores/theme';

/** Shell chrome stores: theme color mode and sidebar toggles (JUM-796). */
describe('theme and sidebar stores (JUM-796)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('switches the color mode through toggleTheme', () => {
    expect.hasAssertions();
    const theme = useThemeStore();
    expect(theme.theme).toBe('light');
    theme.toggleTheme('dark');
    expect(theme.theme).toBe('dark');
    theme.toggleTheme('auto');
    expect(theme.theme).toBe('auto');
  });

  it('toggles sidebar visibility explicitly and implicitly', () => {
    expect.hasAssertions();
    const sidebar = useSidebarStore();
    expect(sidebar.visible).toBeUndefined();
    sidebar.toggleVisible(true);
    expect(sidebar.visible).toBe(true);
    sidebar.toggleVisible();
    expect(sidebar.visible).toBe(false);
    sidebar.toggleUnfoldable();
    expect(sidebar.unfoldable).toBe(true);
  });
});
