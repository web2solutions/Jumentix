/* eslint-disable import-x/order -- the Mantine base styles must precede the
   theme overrides (CSS cascade is order-sensitive; see the inline note). */
import '@mantine/core/styles.css';

// !! The order of these imports is important !!
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

export const { metadata } = config;
export const dynamic = 'force-dynamic';

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
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
    <html
      data-scroll-behavior="smooth"
      dir="ltr"
      lang="en"
      {...mantineHtmlProps}
      // Override after mantineHtmlProps so SSR HTML matches the default
      // scheme the beforeInteractive bootstrap and MantineProvider expect
      // (avoids React #418 on <html>). Storage still wins via the script.
      suppressHydrationWarning
      data-mantine-color-scheme={head.mantine.defaultColorScheme}
    >
      <head>
        <Script id="mantine-color-scheme" nonce={head.mantine.nonce} strategy="beforeInteractive">
          {colorSchemeBootstrap}
        </Script>
        <link href="/brand/jumentix-icon.png" rel="icon" type="image/png" />
        <link href="/brand/jumentix-icon.png" rel="apple-touch-icon" />
        <meta
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
          name="viewport"
        />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider defaultColorScheme={head.mantine.defaultColorScheme} theme={theme}>
          <CommercialChrome>{children}</CommercialChrome>
        </MantineProvider>
        <Analytics />
      </body>
    </html>
  );
};

export default RootLayout;
