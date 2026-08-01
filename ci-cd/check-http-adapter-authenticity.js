#!/usr/bin/env bun
/**
 * Requirement 108 — an HTTP adapter must integrate the framework it is named for.
 *
 * The audit that produced this check found two distinct defects, and the second
 * is the one worth building a tool for.
 *
 * **Undeclared dependency.** `sails-js`, `derby-js`, `loopback` and `feathers`
 * genuinely integrate their frameworks — `new Sails()`, `derby.createApp()`,
 * `new RestApplication()`, `feathers()` — but none of those packages is declared
 * in any manifest or present in `node_modules`. `bun run dev:sails-js` fails
 * with "Cannot find module". The code is right; the dependency is missing.
 *
 * **Swallowed require.** `adonis-js` and `total-js` do:
 *
 *     try { this.application.http = require('@adonisjs/http-server'); }
 *     catch { this.application.http = null; }
 *
 * The framework is assigned to a field and never used. Routing runs on
 * `find-my-way` over Node's `http`. When the package is absent — which it is —
 * the catch swallows it and the adapter serves requests perfectly well while
 * integrating nothing.
 *
 * That second pattern is why this check reads more than the import list. A
 * `require` inside a try/catch satisfies every grep, every reviewer skimming the
 * file, and the first version of this very script. It is a false green wearing
 * an import statement.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const adaptersDir = path.join(
  root, 'apps', 'backend-template', 'src', 'interface', 'HTTP', 'adapters'
);

/** Adapters whose named framework must be imported, used, and installed. */
const REQUIRED_FRAMEWORK = {
  express: ['express'],
  fastify: ['fastify'],
  restify: ['restify'],
  'adonis-js': ['@adonisjs/http-server', '@adonisjs/core'],
  feathers: ['@feathersjs/feathers'],
  loopback: ['@loopback/rest', '@loopback/core'],
  'sails-js': ['sails'],
  'derby-js': ['derby'],
  'total-js': ['total4'],
  'cloudflare-workers': ['hono']
};

/**
 * Platform targets with no framework to import.
 *
 * Their contract is a handler signature, not a server. Listed explicitly so a
 * genuinely empty adapter cannot hide behind a guess.
 */
const PLATFORM_TARGETS = new Set(['aws', 'vercel-functions']);

/**
 * Known gaps, tracked in Linear under epic JUM-570.
 *
 * `swallowed` — the require is inside a try/catch and the result is unused.
 * `undeclared` — the integration is real but the package is not installed.
 *
 * Removing an entry is the last step of a fix. An entry left here after its
 * adapter is repaired fails, which stops this becoming a permanent allowlist.
 */
const KNOWN_GAPS = {
  'adonis-js': { issue: 'JUM-571', kind: 'swallowed' },
  'total-js': { issue: 'JUM-576', kind: 'swallowed' },
  feathers: { issue: 'JUM-572', kind: 'undeclared' },
  loopback: { issue: 'JUM-573', kind: 'undeclared' },
  'sails-js': { issue: 'JUM-574', kind: 'undeclared' },
  'derby-js': { issue: 'JUM-575', kind: 'undeclared' }
};

const manifests = [
  path.join(root, 'package.json'),
  path.join(root, 'apps', 'backend-template', 'package.json')
]
  .filter((file) => fs.existsSync(file))
  .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));

function isDeclared(moduleName) {
  return manifests.some((manifest) => {
    const all = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies
    };
    return all[moduleName] !== undefined;
  });
}

function sourceFiles(directory) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) files.push(full);
    }
  };
  walk(directory);
  return files;
}

/**
 * Whether a module is required inside a try/catch whose result is discarded.
 *
 * Deliberately conservative: it looks for the require appearing between a `try`
 * and a `catch` in the same file. A false positive here is a message telling
 * someone to look at code that is fine; a false negative silently blesses the
 * exact pattern this exists to catch.
 */
function isSwallowed(source, moduleName) {
  const pattern = new RegExp(
    `try\\s*\\{[^}]*require\\(['"]${moduleName.replace(/[/@.]/g, '\\$&')}['"]\\)[^}]*\\}\\s*catch`,
    's'
  );
  return pattern.test(source);
}

const failures = [];

const adapters = fs
  .readdirSync(adaptersDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  // Explicit comparator: the default sort coerces to string and orders by UTF-16
  // code unit, which is not the alphabetical order the failure messages imply.
  .sort((left, right) => left.localeCompare(right));

for (const adapter of adapters) {
  if (PLATFORM_TARGETS.has(adapter)) continue;

  const expected = REQUIRED_FRAMEWORK[adapter];
  if (!expected) {
    failures.push(
      `Adapter "${adapter}" is not classified.\n`
        + '  Add it to REQUIRED_FRAMEWORK with the module it must integrate, or to\n'
        + '  PLATFORM_TARGETS if it is a handler-based target with no framework.\n'
        + '  An unclassified adapter is how an empty one slips in unnoticed.'
    );
    continue;
  }

  const sources = sourceFiles(path.join(adaptersDir, adapter))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');

  const referenced = expected.filter(
    (name) => sources.includes(`'${name}'`) || sources.includes(`"${name}"`)
  );
  const swallowedOnly = referenced.length > 0
    && referenced.every((name) => isSwallowed(sources, name));
  const declared = expected.some((name) => isDeclared(name));

  const healthy = referenced.length > 0 && !swallowedOnly && declared;
  const gap = KNOWN_GAPS[adapter];

  if (healthy && gap) {
    failures.push(
      `Adapter "${adapter}" is now healthy but is still listed as a known gap (${gap.issue}).\n`
        + '  Remove it from KNOWN_GAPS. A registry that keeps fixed entries stops being a\n'
        + '  record of outstanding work and becomes a permanent allowlist.'
    );
    continue;
  }

  if (healthy || gap) continue;

  if (referenced.length === 0) {
    failures.push(
      `Adapter "${adapter}" never references ${expected.join(' or ')}.\n`
        + '  Requirement 108: an adapter named for a framework must integrate it, not\n'
        + '  implement the HTTP port over Node\'s own `http`.'
    );
  } else if (swallowedOnly) {
    failures.push(
      `Adapter "${adapter}" requires ${expected.join(' or ')} inside a try/catch and does\n`
        + '  not use the result. That is the worst shape available: it satisfies every grep\n'
        + '  and every skim while the adapter actually serves requests on Node\'s `http`.\n'
        + '  Integrate the framework, or remove the adapter (Requirement 108).'
    );
  } else if (!declared) {
    failures.push(
      `Adapter "${adapter}" integrates ${expected.join(' or ')} but no manifest declares it.\n`
        + '  The code is correct and the adapter cannot run — the import resolves to nothing,\n'
        + '  so `dev:${adapter}` fails with "Cannot find module".\n'
        + '  Declare the dependency, or remove the adapter (Requirement 108 §2).'
    );
  }
}

if (failures.length > 0) {
  console.error('HTTP adapter authenticity check failed (Requirement 108):\n');
  for (const failure of failures) console.error(`- ${failure}\n`);
  process.exit(1);
}

const tracked = Object.keys(KNOWN_GAPS).length;
const verified = adapters.length - tracked - PLATFORM_TARGETS.size;
const issues = Object.values(KNOWN_GAPS).map((gap) => gap.issue).join(', ');

console.log(
  `HTTP adapter authenticity check passed: ${verified} integrate their framework, `
    + `${PLATFORM_TARGETS.size} are platform targets, ${tracked} tracked gaps (${issues}).`
);
