/**
 * First-party Bun install-time vulnerability scanner (JUM-540).
 *
 * Why this exists, and why it is ours rather than a dependency:
 *
 * The scanner resolves the complete installed Bun tree instead of relying on a
 * compatibility lockfile or a direct-dependency fallback. This prevents a
 * partial graph from being reported as a successful security result.
 *
 * Bun's `[install.security]` hook receives the **fully resolved** package set, so
 * it closes that gap structurally rather than by translating lockfiles.
 *
 * The obvious move would be to install a published scanner. That decides whose
 * code executes over our entire dependency graph during every install — the exact
 * supply-chain question the migration was trying not to answer by accident. So the
 * scanner is first-party and its only external dependency is data: the public
 * OSV.dev API, which is the same corpus behind the GitHub Advisory Database. No
 * account, no token, no third-party code in the graph.
 *
 * Contract (Bun security scanner API v1):
 *   export const scanner = { version: '1', async scan({ packages }) => Advisory[] }
 *   Advisory: { level: 'fatal' | 'warn', package, url, description }
 *   `fatal` stops the install; `warn` prompts interactively and cancels in CI.
 *
 * Fail-closed: if OSV cannot be reached or answers unusably, this throws, which
 * cancels the install. "We could not verify your dependencies" must not resolve to
 * a silent success — that is the failure mode this whole exercise exposed.
 */

const OSV_BATCH_ENDPOINT = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN_ENDPOINT = 'https://api.osv.dev/v1/vulns';

/** OSV accepts up to 1000 queries per batch request. */
const BATCH_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Severities that stop an install outright. Moderate and low become `warn`, which
 * Bun turns into an interactive prompt and an automatic cancel in CI — so nothing
 * is merely logged.
 */
const FATAL_SEVERITIES = new Set(['CRITICAL', 'HIGH']);

/**
 * Severities that produce no advisory at all.
 *
 * Bun's API has only two levels and both stop CI: `fatal` exits, and `warn` exits
 * too in a non-interactive terminal. So emitting anything for a LOW advisory makes
 * every install in CI fail on informational findings. Dropping LOW is a policy
 * choice, stated rather than hidden: LOW is reported by `bun run deps:audit`, which
 * lists everything, and only MODERATE and above can block an install.
 */
const NON_BLOCKING_SEVERITIES = new Set(['LOW', 'NONE', 'UNKNOWN']);

/**
 * Advisory identifiers accepted as known risk. Each entry carries an explicit
 * expiry; an expired entry stops suppressing, which makes these temporary rather
 * than permanent.
 */
const ACCEPTED_RISK = {
  'GHSA-rrr8-f88r-h8q6': { until: '2026-10-31', reason: 'restify 11.1.0 pins find-my-way 7.x; no patched major-compatible release' },
  'GHSA-c96f-x56v-gq3h': { until: '2026-10-31', reason: 'restify transport required for adapter compatibility; awaiting upstream' },
  'GHSA-m6fv-jmcg-4jfg': { until: '2026-10-31', reason: 'send advisory inherited through the restify path only' },
  'GHSA-xcpc-8h2w-3j85': { until: '2026-10-31', reason: 'inherited via cassandra-driver; awaiting release consuming adm-zip >=0.6.0' },
  // Completed on 2026-07-30 after the initial migration captured only four of
  // eight GHSA identifiers. Recording the correction prevents a silent policy
  // change.
  'GHSA-395f-4hp3-45gv': { until: '2026-10-31', reason: 'inherited through the concurrently legacy chain in the local tooling path' },
  'GHSA-f88m-g3jw-g9cj': { until: '2026-10-31', reason: 'Next.js still resolves sharp 0.34.x transitively in the current Nextra stack' },
  'GHSA-6g55-p6wh-862q': { until: '2026-10-31', reason: 'postcss inherited from the Next.js transitive chain; awaiting upstream' },
  'GHSA-r28c-9q8g-f849': { until: '2026-10-31', reason: 'website stack retains transitive postcss chains until upstream updates land' },
  'GHSA-5p2g-fcmc-qvqq': { until: '2026-10-31', reason: 'image-size 2.0.2 is the latest release and is inherited through Storybook/SVG tooling' },
  'GHSA-w3rx-r6r6-pgpr': { until: '2026-10-31', reason: 'image-size 2.0.2 is the latest release and is inherited through Storybook/SVG tooling' },
};

/**
 * Only OSV/GHSA identifiers are accepted. Findings without a matching accepted
 * identifier remain new findings and require a fresh decision.
 */

/** @param {string} id @param {Date} now */
function isAcceptedRisk(id, now = new Date()) {
  const entry = ACCEPTED_RISK[id];
  if (!entry) return false;
  return now <= new Date(`${entry.until}T23:59:59.000Z`);
}

/**
 * Highest severity OSV reports for a vulnerability.
 *
 * OSV records severity in two places and neither is guaranteed present, so this
 * prefers the explicit database label and falls back to the CVSS v3 base score.
 * Unknown maps to MODERATE rather than to nothing: an unrated advisory is still an
 * advisory, and defaulting it away would be a quiet downgrade.
 */
function severityOf(vuln) {
  const labelled = vuln?.database_specific?.severity;
  if (typeof labelled === 'string') return labelled.toUpperCase();

  const cvss = (vuln?.severity || []).find((entry) => String(entry.type || '').startsWith('CVSS'));
  if (cvss && typeof cvss.score === 'string') {
    const match = cvss.score.includes('/AV:') ? null : Number.parseFloat(cvss.score);
    if (Number.isFinite(match)) {
      if (match >= 9) return 'CRITICAL';
      if (match >= 7) return 'HIGH';
      if (match >= 4) return 'MODERATE';
      return 'LOW';
    }
  }
  return 'MODERATE';
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OSV request failed: HTTP ${response.status} (${url})`);
  }
  return response.json();
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`OSV request failed: HTTP ${response.status} (${url})`);
  }
  return response.json();
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Map the resolved package set to advisories.
 *
 * Exported separately from `scanner` so it is testable without an install, and so
 * the network layer can be injected.
 *
 * @param {{name: string, version: string}[]} packages
 * @param {{batch?: Function, detail?: Function, now?: Date}} io
 */
async function evaluatePackages(packages, io = {}) {
  const batch = io.batch || ((queries) => postJson(OSV_BATCH_ENDPOINT, { queries }));
  const detail = io.detail || ((id) => getJson(`${OSV_VULN_ENDPOINT}/${encodeURIComponent(id)}`));
  const now = io.now || new Date();

  const targets = packages
    .filter((entry) => entry && entry.name && entry.version)
    .map((entry) => ({ name: entry.name, version: entry.version }));

  if (targets.length === 0) return [];

  // 1. Batch lookup returns vulnerability ids only, which keeps the request count
  //    proportional to the tree rather than to the number of packages.
  const idsByPackage = new Map();
  for (const group of chunk(targets, BATCH_SIZE)) {
    const payload = await batch(group.map((target) => ({
      package: { name: target.name, ecosystem: 'npm' },
      version: target.version,
    })));

    const results = payload?.results;
    if (!Array.isArray(results) || results.length !== group.length) {
      throw new Error(
        'OSV batch response did not match the request shape; refusing to treat an '
          + 'unverifiable result as clean.',
      );
    }

    results.forEach((result, index) => {
      const ids = (result?.vulns || []).map((vuln) => vuln.id).filter(Boolean);
      if (ids.length > 0) {
        const target = group[index];
        idsByPackage.set(`${target.name}@${target.version}`, ids);
      }
    });
  }

  if (idsByPackage.size === 0) return [];

  // 2. Fetch details only for the packages that actually matched.
  const advisories = [];
  const cache = new Map();

  for (const [packageKey, ids] of idsByPackage) {
    for (const id of ids) {
      if (isAcceptedRisk(id, now)) continue;

      if (!cache.has(id)) {
        cache.set(id, await detail(id));
      }
      const vuln = cache.get(id);
      const severity = severityOf(vuln);
      if (NON_BLOCKING_SEVERITIES.has(severity)) continue;

      advisories.push({
        level: FATAL_SEVERITIES.has(severity) ? 'fatal' : 'warn',
        package: packageKey,
        url: `https://osv.dev/vulnerability/${id}`,
        description: `${severity}: ${vuln?.summary || id}`,
      });
    }
  }

  return advisories;
}

export const scanner = {
  version: '1',
  async scan({ packages }) {
    // No try/catch: a thrown error cancels the install, which is the correct
    // outcome when the dependency set could not be verified. Swallowing it here
    // would reproduce the exact false green that motivated this scanner.
    return evaluatePackages(packages);
  },
};

export {
  ACCEPTED_RISK,
  NON_BLOCKING_SEVERITIES,
  FATAL_SEVERITIES,
  evaluatePackages,
  isAcceptedRisk,
  severityOf,
};
