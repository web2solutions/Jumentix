import { render as testingLibraryRender } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { theme } from '../theme';

/**
 * JUM-701: pin the colour scheme before the first paint.
 *
 * Mantine writes `data-mantine-color-scheme` on the root after mounting.
 * Components that watch that attribute — `MonacoCodeBlock` does, to retheme the
 * editor — therefore see it change mid-test and update outside `act`. Setting
 * it first means the observed value never changes during a test, and the
 * component's own change path is exercised by suites that toggle it on purpose.
 */
export function render(ui: React.ReactNode) {
  document.documentElement.setAttribute('data-mantine-color-scheme', 'light');

  return testingLibraryRender(<>{ui}</>, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MantineProvider theme={theme} env="test" forceColorScheme="light">
        {children}
      </MantineProvider>
    ),
  });
}
