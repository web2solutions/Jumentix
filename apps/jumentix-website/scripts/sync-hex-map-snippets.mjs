import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// JUM-771: curated, real-file previews for the /architecture hexagonal map.
// Each layer links to one representative file actually shipped in
// apps/backend-template. Content is baked at build time (this script runs as
// part of `content:sync`/`prebuild`) rather than read at request time, because
// the website deploys standalone (JUM-915: Vercel builds only this app's
// output) and cannot assume `apps/backend-template` is present at runtime.

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(appRoot, '../..');
const outputPath = path.join(appRoot, 'content', 'generated', 'hex-map-snippets.json');

const MAX_LINES = 120;

/** One real file per hexagonal layer, chosen to match the copy already shown in HexagonalArchitectureMap. */
const SOURCES = [
  {
    id: 'domain',
    repoPath: 'apps/backend-template/src/modules/Users/domain/security/Rbac.ts'
  },
  {
    id: 'application',
    repoPath: 'apps/backend-template/src/modules/Users/application/UserUseCases.ts'
  },
  {
    id: 'ports',
    repoPath: 'apps/backend-template/src/modules/Users/application/ports/IUserUseCases.ts'
  },
  {
    id: 'inbound',
    repoPath: 'apps/backend-template/src/interface/GUI/README.md'
  },
  {
    id: 'outbound',
    repoPath: 'apps/backend-template/src/modules/Users/adapters/out/persistence/UserDataRepository.ts'
  },
  {
    id: 'composition',
    repoPath: 'apps/backend-template/src/modules/Users/composition/composeUsersAuthServices.ts'
  }
];

function assertInsideMonorepo(resolvedPath) {
  const relative = path.relative(monorepoRoot, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`[sync-hex-map-snippets] refusing to read outside the monorepo: ${resolvedPath}`);
  }
}

async function loadSnippet({ id, repoPath }) {
  const resolved = path.join(monorepoRoot, repoPath);
  assertInsideMonorepo(resolved);
  const raw = await fs.readFile(resolved, 'utf8');
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const truncated = lines.length > MAX_LINES;
  const body = lines.slice(0, MAX_LINES).join('\n').replace(/\n+$/, '');
  const code = truncated
    ? `${body}\n\n// … truncated — full file at ${repoPath}`
    : body;
  return { id, path: repoPath, code };
}

async function main() {
  const snippets = await Promise.all(SOURCES.map(loadSnippet));

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snippets, null, 2)}\n`, 'utf8');
  console.log(`[sync-hex-map-snippets] wrote ${snippets.length} snippets to ${path.relative(appRoot, outputPath)}`);
}

main().catch((error) => {
  console.error('[sync-hex-map-snippets] failed:', error);
  process.exitCode = 1;
});
