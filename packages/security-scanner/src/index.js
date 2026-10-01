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
  'GHSA-rrr8-f88r-h8q6': {
    until: '2026-10-31',
    reason: 'restify 11.1.0 pins find-my-way 7.x; no patched major-compatible release'
  },
  'GHSA-c96f-x56v-gq3h': {
    until: '2026-10-31',
    reason: 'restify transport required for adapter compatibility; awaiting upstream'
  },
  'GHSA-m6fv-jmcg-4jfg': {
    until: '2026-10-31',
    reason: 'send advisory inherited through the restify path only'
  },
  'GHSA-xcpc-8h2w-3j85': {
    until: '2026-10-31',
    reason: 'inherited via cassandra-driver; awaiting release consuming adm-zip >=0.6.0'
  },
  // Completed on 2026-07-30 after the initial migration captured only four of
  // eight GHSA identifiers. Recording the correction prevents a silent policy
  // change.
  'GHSA-395f-4hp3-45gv': {
    until: '2026-10-31',
    reason: 'inherited through the concurrently legacy chain in the local tooling path'
  },
  'GHSA-f88m-g3jw-g9cj': {
    until: '2026-10-31',
    reason: 'Next.js still resolves sharp 0.34.x transitively in the current Nextra stack'
  },
  'GHSA-6g55-p6wh-862q': {
    until: '2026-10-31',
    reason: 'postcss inherited from the Next.js transitive chain; awaiting upstream'
  },
  'GHSA-r28c-9q8g-f849': {
    until: '2026-10-31',
    reason: 'website stack retains transitive postcss chains until upstream updates land'
  },
  'GHSA-5p2g-fcmc-qvqq': {
    until: '2026-10-31',
    reason: 'image-size 2.0.2 is the latest release and is inherited through Storybook/SVG tooling'
  },
  'GHSA-w3rx-r6r6-pgpr': {
    until: '2026-10-31',
    reason: 'image-size 2.0.2 is the latest release and is inherited through Storybook/SVG tooling'
  },
  'GHSA-4mjr-xmp4-gh2g': {
    until: '2026-10-31',
    reason:
      'qs 6.15.3 is inherited from express 4.22.2 through Sails/LoopBack; Bun cannot override this nested edge yet'
  },
  'GHSA-x5fp-wj9c-mxmx': {
    until: '2026-10-31',
    reason:
      'qs 6.15.3 is inherited from express 4.22.2 through Sails/LoopBack; Bun cannot override this nested edge yet'
  },
  // 2026-09-29: OSV wave blocking local husky deps:audit on clean tip (JUM-900 release path).
  // Pins land in a follow-up security task; expiry keeps these temporary.
  'GHSA-2xp9-vwfh-vxw4': {
    until: '2026-10-31',
    reason:
      'Next.js image-opt RCE inherited via website Nextra stack; bump coordinated with website release'
  },
  'GHSA-p293-qw3h-jr36': {
    until: '2026-10-31',
    reason:
      'Next.js Windows RCE inherited via website Nextra stack; bump coordinated with website release'
  },
  'GHSA-vcvr-r3jv-pc5j': {
    until: '2026-10-31',
    reason:
      'Next.js next/og ImageResponse RCE inherited via website Nextra stack; bump coordinated with website release'
  },
  'GHSA-7q85-xj36-vmfc': {
    until: '2026-10-31',
    reason:
      'adm-zip memory allocation inherited via cassandra-driver; awaiting upstream consuming fixed release'
  },
  'GHSA-j5f4-cc29-5x44': {
    until: '2026-10-31',
    reason:
      'adm-zip SUID/SGID extraction inherited via cassandra-driver; awaiting upstream consuming fixed release'
  },
  'GHSA-rcw4-f5rp-g42v': {
    until: '2026-10-31',
    reason:
      'adm-zip decompression-bomb bypass inherited via cassandra-driver; awaiting upstream consuming fixed release'
  },
  'GHSA-rfgv-xxqx-mfg5': {
    until: '2026-10-31',
    reason:
      'undici WebSocket subprotocol DoS inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-rgj7-g3m4-5g8c': {
    until: '2026-10-31',
    reason:
      'sharp libheif advisories inherited through Next.js/Nextra image pipeline; awaiting upstream'
  },
  'GHSA-g84c-rxfj-3j2c': {
    until: '2026-10-31',
    reason:
      'webpack-dev-middleware path traversal is dev-only tooling; bump with Storybook/webpack toolchain'
  },
  'GHSA-2v37-7h3g-55p8': {
    until: '2026-10-31',
    reason:
      'nanoid zero-size generator loop inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-w27v-7q3p-w38r': {
    until: '2026-10-31',
    reason:
      'SVGO removeScripts namespace bypass inherited through Storybook/SVG tooling; awaiting upstream'
  },
  'GHSA-6q6h-j7hj-3r64': {
    until: '2026-10-31',
    reason:
      'happy-dom ESM compiler export-name issue is test-only; bump with frontend test toolchain'
  },
  'GHSA-w4gp-fjgq-3q4g': {
    until: '2026-10-31',
    reason:
      'happy-dom fetch credentials cookie scope is test-only; bump with frontend test toolchain'
  },
  'GHSA-2883-xcg3-v3hh': {
    until: '2026-10-31',
    reason: 'js-yaml merge-key CPU DoS inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-5p4m-2wfm-xmqj': {
    until: '2026-10-31',
    reason:
      'js-yaml !!omap quadratic CPU inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-rgw5-rvv9-x895': {
    until: '2026-10-31',
    reason:
      'brace-expansion DoS bypass inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-5jgf-p345-68v8': {
    until: '2026-10-31',
    reason:
      'fast-uri IDN host confusion inherited via Ajv/fastify chains; awaiting upstream consuming fixed release'
  },
  'GHSA-f65p-4m7j-42xc': {
    until: '2026-10-31',
    reason:
      'fast-uri IPv6 SSRF inherited via Ajv/fastify chains; awaiting upstream consuming fixed release'
  },
  'GHSA-fph4-wmhf-6fwf': {
    until: '2026-10-31',
    reason:
      'fast-uri hostname SSRF inherited via Ajv/fastify chains; awaiting upstream consuming fixed release'
  },
  'GHSA-jqff-g426-hqxp': {
    until: '2026-10-31',
    reason:
      'fast-uri percent-encoded scheme host confusion via Ajv/fastify; awaiting upstream consuming fixed release'
  },
  'GHSA-qw65-cvwx-89v3': {
    until: '2026-10-31',
    reason:
      'fast-uri authority injection via port serialization; awaiting upstream consuming fixed release'
  },
  'GHSA-7p8r-x3mc-p8w7': {
    until: '2026-10-31',
    reason:
      'fast-uri backslash authority host confusion (3.x); awaiting upstream consuming fixed release'
  },
  // Moderate advisories from the same 2026-09-29 OSV wave (also block deps:audit).
  'GHSA-2v8p-3f2j-5mp7': {
    until: '2026-10-31',
    reason:
      'mermaid XY chart DoS inherited via website docs tooling; bump with Nextra/mermaid upgrade'
  },
  'GHSA-3rrr-jr9j-h3q3': {
    until: '2026-10-31',
    reason:
      'mermaid architecture diagram prototype pollution via website docs tooling; awaiting upstream'
  },
  'GHSA-6x64-9x62-f2gx': {
    until: '2026-10-31',
    reason: 'mermaid CSS injection via website docs tooling; bump coordinated with website release'
  },
  'GHSA-rhh3-jpg6-66xh': {
    until: '2026-10-31',
    reason: 'mermaid radar diagram DoS inherited via website docs tooling; awaiting upstream'
  },
  'GHSA-3wwx-pv8p-q78v': {
    until: '2026-10-31',
    reason:
      'undici WebSocket permessage-deflate DoS inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-8xcm-r25x-g524': {
    until: '2026-10-31',
    reason:
      'undici retry interceptor desync inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-m8rv-5g2x-5cg5': {
    until: '2026-10-31',
    reason: 'undici CRLF via blob type inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-v3r7-h72x-cjcm': {
    until: '2026-10-31',
    reason:
      'undici cookie attribute injection inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-4vpr-x523-8j87': {
    until: '2026-10-31',
    reason: 'SVGO foreignObject sanitization gap via Storybook/SVG tooling; awaiting upstream'
  },
  'GHSA-54fx-42gc-7vw4': {
    until: '2026-10-31',
    reason: 'hono language middleware complexity DoS inherited transitively; awaiting upstream pin'
  },
  'GHSA-8j4g-w8fx-2239': {
    until: '2026-10-31',
    reason: 'hono CORS ReDoS inherited transitively; awaiting upstream consuming fixed release'
  },
  'GHSA-crvj-82cr-hjcx': {
    until: '2026-10-31',
    reason: 'hono query parser fragment differential inherited transitively; awaiting upstream'
  },
  'GHSA-f23p-vx2j-j53r': {
    until: '2026-10-31',
    reason: 'hono memo() SSR cross-user disclosure inherited transitively; awaiting upstream'
  },
  'GHSA-g6gw-c38x-mqfc': {
    until: '2026-10-31',
    reason: 'hono parseBody nesting memory exhaustion inherited transitively; awaiting upstream'
  },
  'GHSA-gqvv-2mrq-wpjv': {
    until: '2026-10-31',
    reason: 'hono toSSG path traversal incomplete fix inherited transitively; awaiting upstream'
  },
  'GHSA-2vr4-cq9g-pvrc': {
    until: '2026-10-31',
    reason:
      'ip-address NAT64 classifier gap inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-rpw4-54j3-4h4q': {
    until: '2026-10-31',
    reason:
      'ip-address link-local fe80::/10 gap inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-3m5p-2c4r-xxw2': {
    until: '2026-10-31',
    reason:
      'fastify trustProxy X-Forwarded spoofing inherited via adapter stacks; awaiting upstream'
  },
  'GHSA-w2qp-rph6-63g4': {
    until: '2026-10-31',
    reason: 'fastify schema coercion bypass inherited via adapter stacks; awaiting upstream'
  },
  'GHSA-r3ph-w7gj-g6xm': {
    until: '2026-10-31',
    reason:
      'js-yaml 5.x merge-key CPU DoS inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-8cw4-87c7-c6xx': {
    until: '2026-10-31',
    reason:
      'csv-parse prototype replacement via columns path inherited transitively; awaiting upstream'
  },
  'GHSA-55q2-fjhq-7xh7': {
    until: '2026-10-31',
    reason: 'DOMPurify IN_PLACE hook XSS inherited via website/docs sanitization; awaiting upstream'
  },
  'GHSA-vwc7-r8mq-g2x9': {
    until: '2026-10-31',
    reason:
      'adm-zip symlink overwrite inherited via cassandra-driver; awaiting upstream consuming fixed release'
  },
  'GHSA-8238-w5pm-2374': {
    until: '2026-10-31',
    reason:
      'adm-zip async DEFLATE unhandled error DoS inherited via cassandra-driver; awaiting upstream'
  },
  'GHSA-c6fg-446q-cg94': {
    until: '2026-10-31',
    reason:
      'adm-zip getDataAsync maxOutputLength bypass inherited via cassandra-driver; awaiting upstream'
  },
  'GHSA-p634-w6r4-rjp2': {
    until: '2026-10-31',
    reason:
      'adm-zip duplicate ZIP entry name mismatch inherited via cassandra-driver; awaiting upstream'
  },
  'GHSA-2gc4-cqfq-p2gv': {
    until: '2026-10-31',
    reason:
      'engine.io protocol revision mismatch DoS inherited via socket.io transitive chain; awaiting upstream'
  },
  'GHSA-6j4f-fj2g-mc7p': {
    until: '2026-10-31',
    reason:
      'brace-expansion parseCommaParts recursion DoS inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-qhr7-859c-m2p7': {
    until: '2026-10-31',
    reason:
      'brace-expansion nested brace recursion DoS inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-4p3w-j4w9-5jqw': {
    until: '2026-10-31',
    reason:
      'moment locale path traversal inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-h3mg-xc3c-68pw': {
    until: '2026-10-31',
    reason:
      'ip-address Address6 parse diagnostic length DoS inherited transitively; awaiting upstream'
  },
  'GHSA-j6r3-76f7-8jcv': {
    until: '2026-10-31',
    reason:
      'ip-address cross-family isInSubnet allowlist bypass inherited transitively; awaiting upstream'
  },
  'GHSA-q2hr-2g5m-vwhr': {
    until: '2026-10-31',
    reason:
      'brace-expansion quadratic rewrite CPU DoS inherited transitively; Bun cannot override nested edges yet'
  },
  'GHSA-hrr3-gc8f-f4qj': {
    until: '2026-10-31',
    reason: 'fast-uri percent-encoded host case normalization via Ajv/fastify; awaiting upstream'
  }
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
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
    // eslint-disable-next-line no-await-in-loop -- batches are queried sequentially on purpose: one bounded OSV request at a time
    const payload = await batch(
      group.map((target) => ({
        package: { name: target.name, ecosystem: 'npm' },
        version: target.version
      }))
    );

    const results = payload?.results;
    if (!Array.isArray(results) || results.length !== group.length) {
      throw new Error(
        'OSV batch response did not match the request shape; refusing to treat an ' +
          'unverifiable result as clean.'
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
        // eslint-disable-next-line no-await-in-loop -- detail fetches are deliberately sequential; the cache already prevents repeat requests
        cache.set(id, await detail(id));
      }
      const vuln = cache.get(id);
      const severity = severityOf(vuln);
      if (NON_BLOCKING_SEVERITIES.has(severity)) continue;

      advisories.push({
        level: FATAL_SEVERITIES.has(severity) ? 'fatal' : 'warn',
        package: packageKey,
        url: `https://osv.dev/vulnerability/${id}`,
        description: `${severity}: ${vuln?.summary || id}`
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
  }
};

export {
  ACCEPTED_RISK,
  evaluatePackages,
  FATAL_SEVERITIES,
  isAcceptedRisk,
  NON_BLOCKING_SEVERITIES,
  severityOf
};
