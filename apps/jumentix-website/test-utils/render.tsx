import { Fragment } from 'react';

import { MantineProvider } from '@mantine/core';
import { render as testingLibraryRender } from '@testing-library/react';

import theme from '../theme';

/**
 * JUM-701: pin the colour scheme before the first paint.
 *
 * Mantine writes `data-mantine-color-scheme` on the root after mounting.
 * Components that watch that attribute — `MonacoCodeBlock` does, to retheme the
 * editor — therefore see it change mid-test and update outside `act`. Setting
 * it first means the observed value never changes during a test, and the
 * component's own change path is exercised by suites that toggle it on purpose.
 */
// eslint-disable-next-line import-x/prefer-default-export -- named render is re-exported through the test-utils barrel (import { render } from '@/test-utils')
export function render(ui: React.ReactNode) {
  document.documentElement.setAttribute('data-mantine-color-scheme', 'light');

  return testingLibraryRender(<Fragment>{ui}</Fragment>, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MantineProvider env="test" forceColorScheme="light" theme={theme}>
        {children}
      </MantineProvider>
    )
  });
}
