/* eslint-disable no-console */
/**
 * JUM-655 — every website content file must be reachable, or declared unreachable.
 *
 * Seven files under `apps/jumentix-website/content/` answer 404. The docs route
 * resolver rewrites every single-segment path into the `jumentix/` subtree:
 *
 *   `app/docs/[[...mdxPath]]/page.tsx`
 *   return [alias ? ['jumentix', ...alias] : ['jumentix', ...normalized]];
 *
 * so `/docs/api` is served from `content/jumentix/api`, while the file sits at
 * `content/api.mdx`. Every top-level content file is orphaned by that rewrite.
 *
 * The route sweep skips them by filtering `display: 'hidden'`, which names
 * exactly the orphaned files today. That is a coincidence, not a rule (JUM-640).
 * The first top-level page added without hiding it will 404 with the sweep
 * green — the precise failure the sweep exists to prevent.
 *
 * This asks the real question: can the resolver serve this file at all.
 *
 * The register fails in both directions. A file that is orphaned and unlisted
 * fails. A listed file that has become reachable also fails, because a stale
 * exemption is how a register stops meaning anything.
 */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

const WEBSITE_DIR = 'apps/jumentix-website';
const CONTENT_DIR = `${WEBSITE_DIR}/content`;

/**
 * Content files known to be unreachable, each with the issue that owns the
 * decision. Entries are removed by fixing the file's placement, not by editing
 * this list — the check refuses a listed file that has become reachable.
 */
const ACCEPTED_UNREACHABLE = Object.freeze([
  { file: 'api.mdx', issue: 'JUM-640', reason: 'Nextra starter template leftover' },
  { file: 'inline-svg.mdx', issue: 'JUM-640', reason: 'Nextra starter template leftover' },
  { file: 'mantine.mdx', issue: 'JUM-640', reason: 'Nextra starter template leftover' },
  { file: 'markdown.mdx', issue: 'JUM-640', reason: 'Nextra starter template leftover' },
  { file: 'index.mdx', issue: 'JUM-640', reason: '/docs is served by jumentix/index.mdx' },
  {
    file: 'release-notes.mdx',
    issue: 'JUM-640',
    reason: 'real Jumentix documentation, pending a decision to move it under jumentix/'
  },
  {
    file: 'versioning.mdx',
    issue: 'JUM-640',
    reason: 'real Jumentix documentation, pending a decision to move it under jumentix/'
  }
]);

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(absolute, predicate, out);
      continue;
    }
    if (predicate(absolute)) out.push(absolute);
  }
  return out;
}

/**
 * Whether the docs resolver can serve this content file.
 *
 * The resolver only ever looks inside `jumentix/` (or `pt-BR/jumentix/`), so a
 * file is reachable exactly when it lives under one of those. This mirrors the
 * rewrite rather than re-implementing routing: if the resolver changes, this
 * has to change with it, and the comment above says where to look.
 */
function isReachable(relativePath) {
  const segments = relativePath.split(path.sep);
  if (segments[0] === 'jumentix') return true;
  if (segments[0] === 'pt-BR' && segments[1] === 'jumentix') return true;
  return false;
}

function validateWebsiteContentRoutes(rootDir = process.cwd()) {
  const contentRoot = path.join(rootDir, CONTENT_DIR);
  if (!fs.existsSync(contentRoot)) return [];

  const failures = [];
  const accepted = new Map(ACCEPTED_UNREACHABLE.map((entry) => [entry.file, entry]));
  const seenAccepted = new Set();

  const files = walk(
    contentRoot,
    (file) => /\.mdx?$/.test(file) && !/(^|[\\/])_meta\./.test(file)
  ).map((file) => path.relative(contentRoot, file).replace(/\\/g, path.sep));

  for (const relativePath of files) {
    const reachable = isReachable(relativePath);
    const key = relativePath.split(path.sep).join('/');
    const exemption = accepted.get(key);

    if (exemption) seenAccepted.add(key);

    if (!reachable && !exemption) {
      failures.push(
        `[website-content] ${CONTENT_DIR}/${key} cannot be served: the docs resolver only reads`
        + ' jumentix/ and pt-BR/jumentix/. Move it under one of those, or record it in'
        + ' ACCEPTED_UNREACHABLE with the issue that owns the decision.'
      );
    }

    if (reachable && exemption) {
      failures.push(
        `[website-content] ${CONTENT_DIR}/${key} is reachable but still listed in`
        + ` ACCEPTED_UNREACHABLE (${exemption.issue}). Remove the entry — a stale exemption`
        + ' hides the next real one.'
      );
    }
  }

  for (const [key, entry] of accepted) {
    if (!seenAccepted.has(key)) {
      failures.push(
        `[website-content] ACCEPTED_UNREACHABLE lists ${CONTENT_DIR}/${key} (${entry.issue}),`
        + ' which no longer exists. Remove the entry.'
      );
    }
  }

  return failures;
}

function run(rootDir = process.cwd()) {
  const failures = validateWebsiteContentRoutes(rootDir);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }
  console.log(
    `Website content route check passed: every content file is reachable or declared`
    + ` (${ACCEPTED_UNREACHABLE.length} declared unreachable).`
  );
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = run();
}

module.exports = {
  ACCEPTED_UNREACHABLE,
  isReachable,
  run,
  validateWebsiteContentRoutes
};
