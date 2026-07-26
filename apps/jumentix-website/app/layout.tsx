import '@mantine/core/styles.css';
// !! The order of these imports is important !!
import '@gfazioli/mantine-border-animate/styles.css';
import '@gfazioli/mantine-marquee/styles.css';
import '@gfazioli/mantine-text-animate/styles.css';
// Mantine theme overrides (body background, marquee fade edges, etc.)
import '@/theme/global.css';

import { Analytics } from '@vercel/analytics/react';
import { mantineHtmlProps, MantineProvider } from '@mantine/core';
import Script from 'next/script';
import { CommercialChrome } from '@/components/commercial/CommercialChrome';
// !! End of important imports !!

import config from '@/config';
import { theme } from '../theme';

import './global.css';
import '@/components/design-system/tokens.css';

export const metadata = config.metadata;
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { head } = config;
  const defaultColorScheme = JSON.stringify(head.mantine.defaultColorScheme);
  const colorSchemeBootstrap = `try {
  var storedColorScheme = window.localStorage.getItem("mantine-color-scheme-value");
  var colorScheme = storedColorScheme === "light" || storedColorScheme === "dark" || storedColorScheme === "auto"
    ? storedColorScheme
    : ${defaultColorScheme};
  var computedColorScheme = colorScheme !== "auto"
    ? colorScheme
    : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-mantine-color-scheme", computedColorScheme);
} catch (error) {}`;

  return (
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" {...mantineHtmlProps}>
      <head>
        <Script
          id="mantine-color-scheme"
          nonce={head.mantine.nonce}
          strategy="beforeInteractive"
        >
          {colorSchemeBootstrap}
        </Script>
        <link rel="shortcut icon" href="/favicon.svg" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme={head.mantine.defaultColorScheme}>
          <CommercialChrome>{children}</CommercialChrome>
        </MantineProvider>
        <Analytics />
      </body>
    </html>
  );
}
