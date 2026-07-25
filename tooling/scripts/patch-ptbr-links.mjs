#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const files = execSync("git ls-files '*.pt-BR.md'", { cwd: ROOT, encoding: 'utf-8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const shouldRewrite = (target) =>
  !target.startsWith('http://') &&
  !target.startsWith('https://') &&
  !target.startsWith('mailto:') &&
  !target.startsWith('#') &&
  target.endsWith('.md') &&
  !target.endsWith('.pt-BR.md');

const run = async () => {
  let changed = 0;

  for (const file of files) {
    const absolute = path.join(ROOT, file);
    const sourceDir = path.dirname(absolute);
    let content = await fs.readFile(absolute, 'utf-8');

    const next = content.replace(/\]\(([^)\s]+\.md(?:#[^)]+)?)\)/g, (match, rawTarget) => {
      const [targetPath, hash = ''] = rawTarget.split('#');
      if (!shouldRewrite(targetPath)) return match;

      const ext = path.extname(targetPath);
      const base = targetPath.slice(0, -ext.length);
      const ptTarget = `${base}.pt-BR${ext}`;
      const resolved = path.resolve(sourceDir, ptTarget);

      try {
        execSync(`test -f "${resolved}"`, { stdio: 'ignore' });
        return `](${ptTarget}${hash ? `#${hash}` : ''})`;
      } catch {
        return match;
      }
    });

    if (next !== content) {
      await fs.writeFile(absolute, next, 'utf-8');
      changed += 1;
    }
  }

  console.log(`[pt-BR docs] links ajustados em ${changed} arquivos`);
};

run().catch((error) => {
  console.error('[pt-BR docs] erro ao ajustar links:', error.message);
  process.exit(1);
});
