// !! The order of these imports is important: theme overrides must load after vendor CSS !!
import '@gfazioli/mantine-border-animate/styles.css';
import '@gfazioli/mantine-marquee/styles.css';
import '@gfazioli/mantine-text-animate/styles.css';
import { mantineHtmlProps, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Analytics } from '@vercel/analytics/react';
import Script from 'next/script';

import { CommercialChrome } from '@/components/commercial/CommercialChrome';
import '@/components/design-system/tokens.css';
import config from '@/config';
// Mantine theme overrides (body background, marquee fade edges, etc.)
import '@/theme/global.css';

import './global.css';
import theme from '../theme';

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
