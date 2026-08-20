'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { trimTrailingBlankCodeLines } from './normalizeCode';

export type MDXCodeBlockSource = {
  language?: string;
  value: string;
};

const MDXCodeSourceContext = createContext<MDXCodeBlockSource[]>([]);

function languageFromFenceInfo(info: string): string | undefined {
  const language = info.trim().split(/\s+/)[0]?.trim();
  return language && !language.includes('=') ? language : undefined;
}

function fenceClosePattern(openingFence: string): RegExp {
  const fenceChar = openingFence[0];
  const escapedFenceChar = fenceChar === '`' ? '`' : '\\~';
  return new RegExp(`^${escapedFenceChar}{${openingFence.length},}\\s*$`);
}

export function parseMDXCodeBlocks(sourceCode: string): MDXCodeBlockSource[] {
  const blocks: MDXCodeBlockSource[] = [];
  const lines = sourceCode.replace(/\r\n?/g, '\n').split('\n');
  let active:
    | {
        closePattern: RegExp;
        language?: string;
        lines: string[];
      }
    | undefined;

  for (const line of lines) {
    if (active) {
      if (active.closePattern.test(line)) {
        blocks.push({
          language: active.language,
          value: trimTrailingBlankCodeLines(active.lines.join('\n'))
        });
        active = undefined;
        continue;
      }

      active.lines.push(line);
      continue;
    }

    const opening = line.match(/^(`{3,}|~{3,})(.*)$/);
    if (!opening) continue;

    active = {
      closePattern: fenceClosePattern(opening[1]),
      language: languageFromFenceInfo(opening[2] ?? ''),
      lines: []
    };
  }

  return blocks;
}

export function MDXCodeSourceProvider({
  children,
  sourceCode
}: {
  children: ReactNode;
  sourceCode?: string;
}) {
  const blocks = useMemo(() => parseMDXCodeBlocks(sourceCode ?? ''), [sourceCode]);

  return (
    <MDXCodeSourceContext.Provider value={blocks}>
      {children}
    </MDXCodeSourceContext.Provider>
  );
}

export function useMDXCodeSourceBlocks(): MDXCodeBlockSource[] {
  return useContext(MDXCodeSourceContext);
}
