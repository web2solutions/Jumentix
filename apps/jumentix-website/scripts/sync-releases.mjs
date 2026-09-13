/**
 * Build-time release notes data source for /api/github-releases.
 *
 * Same failure mode as the changelog page (JUM-718): the route proxied the
 * GitHub releases API at request time, and the public canonical repository answers
 * unauthenticated calls with 404, so production rendered a permanent error.
 * Releases are part of the deployed artifact: bake them at build time.
 *
 * Primary source: GitHub releases API with whatever auth the build
 * environment already has (GITHUB_TOKEN, or the gh CLI token). Fallback:
 * an empty list — valid when the repository has no published releases, and
 * far better than a runtime 404.
 *
 * Output: content/releases.json — imported by the API route, so Next.js
 * bundles the data and no runtime secret is required.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const outputPath = path.join(appRoot, 'content', 'releases.json');
const REPO = 'web2solutions/Jumentix';
const MAX_RELEASES = 20;

const RELEASE_FIELDS = [
  'id', 'tag_name', 'name', 'body', 'draft', 'prerelease',
  'created_at', 'published_at', 'html_url', 'target_commitish'
];

function ghCliToken() {
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return token || null;
  } catch {
    return null;
  }
}

async function fetchReleases() {
  const token = process.env.GITHUB_TOKEN ?? ghCliToken();
  if (!token) return null;
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=${MAX_RELEASES}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': REPO,
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(10_000)
      }
    );
    if (!response.ok) return null;
    const releases = await response.json();
    if (!Array.isArray(releases)) return null;
    return releases
      .filter((release) => !release.draft)
      .map((release) => Object.fromEntries(
        RELEASE_FIELDS.map((field) => [field, release[field] ?? null])
      ));
  } catch {
    return null;
  }
}

const releases = (await fetchReleases()) ?? [];
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(releases, null, 2)}\n`, 'utf8');
console.log(`[sync-releases] wrote ${releases.length} releases to content/releases.json`);
