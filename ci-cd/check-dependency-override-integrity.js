/**
 * Dependency override integrity guard.
 *
 * Every override in this repository exists because a CVE or an incompatibility
 * demanded it. Losing one is a *silent security regression*, not a build
 * failure — nothing breaks, the vulnerable transitive version simply comes
 * back. That asymmetry is why this guard exists and why it fails closed.
 *
 * Original purpose (JUM-537) was to detect `bun install` mutating the
 * pnpm-managed tree: the JUM-23 baseline recorded that it dropped
 * `pnpm.patchedDependencies` and merged pnpm-scoped selectors such as
 * `restify>find-my-way` into npm's `overrides`, a form npm rejects with
 * EINVALIDTAGNAME. Once the migration completes there is no pnpm tree left to
 * mutate, so the guard protects the thing that actually still matters: that the
 * full set of security pins survived translation and stays present.
 *
 * The baseline below is frozen from the pre-migration state, which was spread
 * across three disagreeing surfaces:
 *
 *   - pnpm-workspace.yaml `overrides`      — 22 entries (15 flat + 7 nested)
 *   - package.json `pnpm.overrides`        — 2 entries
 *   - package.json `overrides` (npm form)  — 10 entries, flat only
 *
 * Nested selectors were converted to flat pins. That does not widen exposure:
 * a flat override applies to every dependent, which is strictly stronger than
 * pinning one dependent. Six of the seven nested selectors already had an
 * identical flat pin in force, so their behaviour is unchanged. The seventh,
 * `cassandra-driver>adm-zip`, had no flat equivalent and became one.
 *
 * `postcss` was the one genuine conflict: ^8.5.18 in two places, ^8.5.23 in
 * `pnpm.overrides`. Resolved to ^8.5.23 — the higher floor. Both ranges admit
 * 8.5.23, so the only difference is the minimum, and taking the lower value
 * would have quietly relaxed a security floor.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

/**
 * Frozen pre-migration security baseline. Keys are package names; values are
 * the minimum acceptable range. Changing an entry is a deliberate act that
 * belongs in a reviewed commit with the CVE or incompatibility that justifies
 * it — never a side effect of a lockfile refresh.
 */
const REQUIRED_OVERRIDES = {
  'form-data': '^4.0.4',
  uuid: '^11.1.1',
  'js-yaml': '^4.3.0',
  send: '^1.2.0',
  ws: '^8.18.3',
  tar: '^7.5.17',
  'find-my-way': '^9.7.0',
  postcss: '^8.5.23',
  'fast-uri': '^3.1.4',
  svgo: '^4.0.2',
  'fast-xml-parser': '^5.10.1',
  'shell-quote': '^1.9.0',
  'brace-expansion': '^2.1.2',
  sharp: '^0.35.0',
  protobufjs: '^7.6.5',
  // Was `cassandra-driver>adm-zip` under pnpm; the only nested selector with no
  // flat counterpart, so the flat pin below is what carries it forward.
  'adm-zip': '^0.6.0',
};

/** Resolutions that must survive alongside the overrides. */
const REQUIRED_RESOLUTIONS = {
  serverless: '^4.1.12',
};

/**
 * Patches keyed by the exact `name@version` they apply to. A patch silently
 * dropped is the same class of failure as a dropped override.
 */
const REQUIRED_PATCHES = {
  'nextra-theme-docs@4.6.1': 'patches/nextra-theme-docs@4.6.1.patch',
};

const failures = [];

function fail(message) {
  failures.push(message);
}

if (!fs.existsSync(packageJsonPath)) {
  console.error('Dependency override integrity guard failed: package.json is missing.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const overrides = pkg.overrides || {};
const resolutions = pkg.resolutions || {};
const patches = pkg.patchedDependencies || {};

// 1. Every frozen pin is still declared, at the expected range.
for (const [name, expected] of Object.entries(REQUIRED_OVERRIDES)) {
  const actual = overrides[name];
  if (actual === undefined) {
    fail(
      `override "${name}" is missing. It was pinned to ${expected} before the Bun migration; `
        + 'removing it lets the vulnerable transitive version resolve again.',
    );
  } else if (actual !== expected) {
    fail(
      `override "${name}" is "${actual}", expected "${expected}". If this change is intentional, `
        + 'update REQUIRED_OVERRIDES in this guard in the same commit, with the reason.',
    );
  }
}

for (const [name, expected] of Object.entries(REQUIRED_RESOLUTIONS)) {
  if (resolutions[name] !== expected) {
    fail(
      `resolution "${name}" is "${resolutions[name]}", expected "${expected}".`,
    );
  }
}

for (const [target, patchPath] of Object.entries(REQUIRED_PATCHES)) {
  if (patches[target] !== patchPath) {
    fail(
      `patchedDependencies is missing "${target}" -> "${patchPath}". The JUM-23 baseline recorded `
        + '`bun install` dropping this field entirely; that is exactly what this check catches.',
    );
  } else if (!fs.existsSync(path.join(repoRoot, patchPath))) {
    fail(`patch file "${patchPath}" is declared but does not exist on disk.`);
  }
}

// 2. No pnpm-style nested selector keys. npm and Bun both reject `a>b` as a
//    package name; it resolves to nothing and the pin is silently inert.
for (const name of Object.keys(overrides)) {
  if (name.includes('>')) {
    fail(
      `override key "${name}" uses pnpm nested-selector syntax, which Bun and npm do not accept `
        + '(npm reports EINVALIDTAGNAME). Convert it to a flat pin, which is strictly stronger.',
    );
  }
}

// 3. The pnpm surfaces must be gone, not merely unused. Leaving them in place
//    means two sources of truth, and the one CI does not read is the one that
//    goes stale while still looking authoritative.
const retiredSurfaces = [
  ['pnpm-workspace.yaml', path.join(repoRoot, 'pnpm-workspace.yaml')],
  ['pnpm-lock.yaml', path.join(repoRoot, 'pnpm-lock.yaml')],
];

for (const [label, filePath] of retiredSurfaces) {
  if (fs.existsSync(filePath)) {
    fail(
      `${label} still exists. Overrides are now declared once, in package.json. A second surface `
        + 'that CI does not read is a stale pin waiting to be trusted.',
    );
  }
}

if (pkg.pnpm !== undefined) {
  fail('package.json still declares a "pnpm" section. Its contents must move to the Bun equivalents.');
}

if (failures.length > 0) {
  console.error('Dependency override integrity guard failed:\n');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error('');
  process.exit(1);
}

const pinCount = Object.keys(REQUIRED_OVERRIDES).length;
const patchCount = Object.keys(REQUIRED_PATCHES).length;
console.log(
  `Dependency override integrity guard passed: ${pinCount} pins, `
    + `${Object.keys(REQUIRED_RESOLUTIONS).length} resolutions, ${patchCount} patch(es) intact.`,
);
