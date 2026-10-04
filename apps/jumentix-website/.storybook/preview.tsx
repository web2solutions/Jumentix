/* eslint-disable import-x/order -- the Mantine base styles must precede the
   app/theme/design-token styles (CSS cascade is order-sensitive). */
import '@mantine/core/styles.css';

// !! The order of these imports is important !!
import '../theme/global.css';
import '../app/global.css';
import '../components/design-system/tokens.css';

import { MantineProvider } from '@mantine/core';
import { withThemeByClassName } from '@storybook/addon-themes';

import { theme } from '../theme';

export const parameters = {
  layout: 'fullscreen',
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/i
    }
  },
  a11y: {
    test: 'error'
  },
  docs: {
    toc: true
  },
  options: {
    // @ts-expect-error – storybook throws build error for (a: any, b: any)
    storySort: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })
  },
  backgrounds: { disable: true }
};

export const decorators = [
  withThemeByClassName({
    themes: {
      light: '',
      dark: 'dark'
    },
    defaultTheme: 'light'
  }),
  (renderStory: any, context: any) => (
    <MantineProvider
      forceColorScheme={context.globals.theme === 'dark' ? 'dark' : 'light'}
      theme={theme}
    >
      <main className="jtx-story-canvas">{renderStory()}</main>
    </MantineProvider>
  )
];
