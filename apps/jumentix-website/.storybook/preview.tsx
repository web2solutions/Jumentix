// !! The order of these imports is important: theme overrides must load after vendor CSS !!
import '@gfazioli/mantine-marquee/styles.css';
import '@gfazioli/mantine-text-animate/styles.css';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { withThemeByClassName } from '@storybook/addon-themes';

import '../app/global.css';
import '../components/design-system/tokens.css';
import theme from '../theme';
import '../theme/global.css';

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
