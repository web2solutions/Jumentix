import {
  computed, onMounted, onUnmounted, ref
} from 'vue';

/** CoreUI/Bootstrap breakpoints used by the multitask shell (JUM-799). */
export const SHELL_BREAKPOINTS = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400
} as const;

export type ShellViewport = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export const viewportForWidth = (width: number): ShellViewport => {
  if (width >= SHELL_BREAKPOINTS.xxl) return 'xxl';
  if (width >= SHELL_BREAKPOINTS.xl) return 'xl';
  if (width >= SHELL_BREAKPOINTS.lg) return 'lg';
  if (width >= SHELL_BREAKPOINTS.md) return 'md';
  if (width >= SHELL_BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

export const useShellViewport = () => {
  const width = ref(typeof window === 'undefined' ? SHELL_BREAKPOINTS.lg : window.innerWidth);
  const onResize = () => {
    width.value = window.innerWidth;
  };
  onMounted(() => {
    width.value = window.innerWidth;
    window.addEventListener('resize', onResize);
  });
  onUnmounted(() => {
    window.removeEventListener('resize', onResize);
  });
  const viewport = computed(() => viewportForWidth(width.value));
  return {
    width,
    viewport,
    isPhone: computed(() => width.value < SHELL_BREAKPOINTS.md),
    isTablet: computed(() => (
      width.value >= SHELL_BREAKPOINTS.md && width.value < SHELL_BREAKPOINTS.lg
    )),
    isDesktop: computed(() => width.value >= SHELL_BREAKPOINTS.lg),
    compactTaskbar: computed(() => width.value < SHELL_BREAKPOINTS.md),
    bottomSheetSwitcher: computed(() => width.value < SHELL_BREAKPOINTS.sm),
    widgetsOverflow: computed(() => width.value < SHELL_BREAKPOINTS.md)
  };
};
