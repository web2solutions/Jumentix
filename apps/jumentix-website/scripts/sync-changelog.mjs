/**
 * Build-time changelog data source for the public /changelog page.
 *
 * The page previously fetched the GitHub commits API at request time. The
 * repository is private, so any environment without a valid GITHUB_TOKEN
 * (production Vercel included) got a 404 and an empty page. The changelog is
 * part of the deployed artifact, not a remote service: this script bakes it
 * at build time.
 *
 * Primary source: `git log` of the checkout being built (full fidelity:
 * sha, ISO date, author, subject). Fallback: the generated CHANGELOG.md at
 * the monorepo root (no shas, but always present, even in shallow clones).
 *
 * Output: content/changelog.json — imported by ChangelogPage.tsx, so the
 * data is bundled by Next.js and works in static, serverless and ISR.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(appRoot, '../..');
const outputPath = path.join(appRoot, 'content', 'changelog.json');
const MAX_ENTRIES = 2000;

function fromGitLog() {
  try {
    const raw = execFileSync(
      'git',
      ['log', `--pretty=format:%H%x1f%aI%x1f%an%x1f%s`, '-n', String(MAX_ENTRIES)],
      { cwd: monorepoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const entries = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [sha, date, author, ...rest] = line.split('\x1f');
        return { sha, date, author, message: rest.join('\x1f') };
      })
      .filter((entry) => entry.sha && entry.date && entry.message);
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

async function fromChangelogMd() {
  const raw = await fs.readFile(path.join(monorepoRoot, 'CHANGELOG.md'), 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^- \d{4}-\d{2}-\d{2} /.test(line))
    .map((line) => {
      const body = line.slice(2);
      const date = body.slice(0, 10);
      const rest = body.slice(11);
      const separator = rest.lastIndexOf(' - ');
      return {
        sha: null,
        date,
        author: separator >= 0 ? rest.slice(separator + 3) : '',
        message: separator >= 0 ? rest.slice(0, separator) : rest
      };
    });
}

const entries = fromGitLog() ?? (await fromChangelogMd());
if (entries.length === 0) {
  throw new Error('sync-changelog: no changelog entries found from git log or CHANGELOG.md');
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
console.log(`[sync-changelog] wrote ${entries.length} entries to content/changelog.json`);
