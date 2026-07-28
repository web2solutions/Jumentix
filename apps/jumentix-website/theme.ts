'use client';

import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'sm',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
  headings: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '700'
  },
  colors: {
    jumentixBlue: [
      '#eff7ff',
      '#dcecff',
      '#b8d9ff',
      '#8ac0ff',
      '#55a3ff',
      '#2f88f5',
      '#166bd5',
      '#1257ae',
      '#134a8d',
      '#123f73'
    ],
    signalGreen: [
      '#edfcf4',
      '#d4f8e3',
      '#a9efc8',
      '#76e2aa',
      '#3bcf87',
      '#16b86c',
      '#0b9657',
      '#087847',
      '#09603b',
      '#084f33'
    ],
    signalCoral: [
      '#fff1ed',
      '#ffe0d7',
      '#ffc0ad',
      '#ff987a',
      '#f86c49',
      '#e94d2b',
      '#c6381d',
      '#a32e1a',
      '#86291b',
      '#6f251b'
    ]
  }
});
