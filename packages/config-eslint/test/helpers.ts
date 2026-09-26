import { join } from 'node:path';

import { ESLint } from 'eslint';

import type { Linter } from 'eslint';

import type { FlatConfig } from '../src';

const FIXTURES_ROOT = `${join(__dirname, 'fixtures')}/`;

export function fixturesRoot(): string {
  return FIXTURES_ROOT;
}

/**
 * Lints fixture files with a composed flat config and returns the messages
 * per file. Fails loudly when the config's `files` globs match nothing —
 * an empty glob must never read as "0 problems" (JUM-14 / JUM-19). ESLint
 * silently returns an empty message list for a file no config block matches,
 * so coverage is verified per file with calculateConfigForFile.
 */
export async function lintFixtures(
  config: FlatConfig[],
  files: string[]
): Promise<ESLint.LintResult[]> {
  if (files.length === 0) {
    throw new Error('empty-glob: no fixture files provided');
  }
  const eslint = new ESLint({
    cwd: FIXTURES_ROOT,
    overrideConfigFile: true,
    overrideConfig: config,
    ignore: false
  });
  const results = await eslint.lintFiles(files);
  if (results.length === 0) {
    throw new Error(`empty-glob: config matched zero fixture files for ${JSON.stringify(files)}`);
  }
  await Promise.all(
    files.map(async (file) => {
      const calculated = await eslint.calculateConfigForFile(file);
      // An unmatched file still returns ESLint's defaults (parser, plugins)
      // but zero rules — that is the silent false-green this guard exists for.
      if (!calculated || Object.keys(calculated.rules ?? {}).length === 0) {
        throw new Error(`empty-glob: no config block matched fixture ${file}`);
      }
    })
  );
  return results;
}

export function allMessages(results: ESLint.LintResult[]): Linter.LintMessage[] {
  return results.flatMap((result) => result.messages);
}

export function ruleIds(results: ESLint.LintResult[]): string[] {
  return [...new Set(allMessages(results).map((message) => message.ruleId ?? 'parse-error'))];
}
