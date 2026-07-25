import '@mantine/core/styles.css';
// !! The order of these imports is important !!
import '@gfazioli/mantine-border-animate/styles.css';
import '@gfazioli/mantine-marquee/styles.css';
import '@gfazioli/mantine-text-animate/styles.css';
// Mantine theme overrides (body background, marquee fade edges, etc.)
import '@/theme/global.css';

import { Analytics } from '@vercel/analytics/react';
import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
// !! End of important imports !!

import config from '@/config';
import { theme } from '../theme';

import './global.css';

export const metadata = config.metadata;
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { head } = config;

  return (
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript
          nonce={head.mantine.nonce}
          defaultColorScheme={head.mantine.defaultColorScheme}
        />
        <link rel="shortcut icon" href="/favicon.svg" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme={head.mantine.defaultColorScheme}>
          {children}
        </MantineProvider>
        <Analytics />
      </body>
    </html>
  );
}
