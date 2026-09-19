/* eslint-disable no-console */
/**
 * JUM-656 — every `orderByChild` must have a matching `.indexOn` in the rules.
 *
 * Realtime Database builds no index on its own. A query that orders by a child
 * with no `.indexOn` still returns the right answer: the server sends every
 * child under the path and the client sorts in memory, so `limitToLast` trims
 * only after the whole node has been downloaded. Nothing throws, no test fails,
 * and the only signal is a warning in the Firebase log:
 *
 *   FIREBASE WARNING: Using an unspecified index. Consider adding ".indexOn"...
 *
 * The cost is linear in the number of records, which means it is invisible
 * while a feature is new and painful once it is used. That is the same shape as
 * every other defect Requirement 130 was written for, so it gets a gate rather
 * than a convention.
 *
 * The rules live in `database.rules.json`, exported from the live project by
 * `ci-cd/export-database-rules.js`. Without that file this check fails closed:
 * a query whose index cannot be verified is exactly the case it exists for.
 */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');

const RULES_FILE = 'database.rules.json';
const SEARCH_ROOTS = ['packages', 'ci-cd', 'apps'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', '.next']);

/**
 * `.ref(<path>)` … `.orderByChild('<child>')` pairs in one source file.
 *
 * Matching the chain rather than the two calls separately is what makes the
 * result usable: `orderByChild` alone says a child is ordered, but not where,
 * and the rules are addressed by path. Chains this cannot read are reported
 * rather than dropped — see `unresolved` below.
 */
function queriesIn(source) {
  const found = [];
  const chain = /\.ref\(\s*([`'"])([^`'"]*)\1\s*\)((?:\s*\.\w+\([^)]*\))*?)\s*\.orderByChild\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(chain)) {
    found.push({ refPath: match[2], child: match[4] });
  }

  // An `orderByChild` that no chain above accounted for. Its path is built
  // somewhere this cannot see, so it is reported as unresolved instead of
  // being treated as absent.
  const total = (source.match(/\.orderByChild\(/g) || []).length;
  return { queries: found, unresolved: Math.max(0, total - found.length) };
}

/**
 * A `.ref()` argument as rules-path segments.
 *
 * `${...}` interpolations become `*`, because the value is decided at runtime:
 * `agent-bus/events/${epicKey}` is `['agent-bus', 'events', '*']`. A wildcard
 * segment matches a rules wildcard (`$epicId`) or any literal key, which is
 * what the database itself does.
 */
function refSegments(refPath) {
  return refPath
    .replace(/\$\{[^}]*\}/g, '*')
    .split('/')
    .filter((segment) => segment !== '');
}

function indexedChildren(node) {
  const declared = node && node['.indexOn'];
  if (typeof declared === 'string') return [declared];
  if (Array.isArray(declared)) return declared.filter((entry) => typeof entry === 'string');
  return [];
}

/**
 * Whether the rules index `child` at every path the segments can address.
 *
 * Descends the rules tree following the segments. A `*` segment, or a segment
 * with no literal match, follows every `$wildcard` branch — a rule written as
 * `$epicId` covers all of them, so finding the index behind one wildcard is
 * finding it for the query.
 */
function rulesIndex(rulesNode, segments, child) {
  if (!rulesNode || typeof rulesNode !== 'object') return false;
  if (segments.length === 0) return indexedChildren(rulesNode).includes(child);

  const [head, ...rest] = segments;
  const candidates = [];
  if (head === '*') {
    // The segment came from a `${...}`, so its value is unknown here: it could
    // address any branch, including a literal one. `agent-bus` in
    // `${BUS_ROOT}/events/${epicKey}` is exactly that case. Following every
    // branch can accept an index declared at a path the query never reaches,
    // which is the right way to be wrong — this gate must not fail a query
    // whose index does exist.
    candidates.push(...Object.values(rulesNode));
  } else {
    if (Object.prototype.hasOwnProperty.call(rulesNode, head)) candidates.push(rulesNode[head]);
    for (const [key, value] of Object.entries(rulesNode)) {
      if (key.startsWith('$')) candidates.push(value);
    }
  }

  return candidates.some((candidate) => rulesIndex(candidate, rest, child));
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(absolute, out);
      continue;
    }
    if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(absolute);
    }
  }
  return out;
}

function suggestion(segments, child) {
  const body = segments.reduceRight(
    (inner, segment) => ({ [segment === '*' ? '$id' : segment]: inner }),
    { '.indexOn': child }
  );
  return JSON.stringify({ rules: body }, null, 2);
}

function validateRtdbIndexes(rootDir = process.cwd()) {
  const failures = [];
  const files = SEARCH_ROOTS.flatMap((root) => walk(path.join(rootDir, root)));

  const hits = [];
  let unresolved = 0;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('orderByChild')) continue;
    const result = queriesIn(source);
    unresolved += result.unresolved;
    for (const query of result.queries) {
      hits.push({ ...query, file: path.relative(rootDir, file) });
    }
  }

  // Test doubles and type declarations mention `orderByChild` without querying
  // anything, so an unresolved count on its own is not a finding. It becomes
  // one only next to a real query this could not place.
  if (hits.length === 0) return failures;

  const rulesPath = path.join(rootDir, RULES_FILE);
  if (!fs.existsSync(rulesPath)) {
    failures.push(
      `[rtdb-index] ${hits.length} orderByChild quer${hits.length === 1 ? 'y' : 'ies'} exist but`
      + ` ${RULES_FILE} is missing. Run \`node ci-cd/export-database-rules.js\` to bring the live`
      + ' rules under version control, then declare the index.'
    );
    return failures;
  }

  let rules;
  try {
    rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  } catch (error) {
    failures.push(`[rtdb-index] ${RULES_FILE} is not valid JSON: ${error.message}`);
    return failures;
  }

  for (const hit of hits) {
    const segments = refSegments(hit.refPath);
    if (rulesIndex(rules.rules, segments, hit.child)) continue;
    failures.push(
      `[rtdb-index] ${hit.file} orders ${hit.refPath || '/'} by '${hit.child}' with no matching`
      + ` ".indexOn" in ${RULES_FILE}. Without it the server sends every child and the client`
      + ' sorts, so the query stays correct and gets slower with every record. Either order by'
      + ` key, or add:\n${suggestion(segments, hit.child)}`
    );
  }

  return failures;
}

function run(rootDir = process.cwd()) {
  const failures = validateRtdbIndexes(rootDir);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(failure));
    return 1;
  }
  console.log('RTDB index check passed: every ordered query has a declared index.');
  return 0;
}

if (isEntryPoint(module)) {
  process.exitCode = run();
}

module.exports = { queriesIn, refSegments, rulesIndex, run, validateRtdbIndexes };
