/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');
const { byPath } = require('./lib/mapped-suites.js');

const PACKAGES_DIR = 'packages';

function walk(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p, pred, out);
    } else if (pred(p)) {
      out.push(p.replace(/\\/g, '/'));
    }
  }
  return out;
}

function classifyUnit(file) {
  const rel = file.replace(/^apps\/backend-template\/test\/unit\//, '');
  if (rel.startsWith('modules/Users/domain/')) return { layer: 'domain', kind: 'hexagonal' };
  if (
    rel.startsWith('modules/Users/application/')
    || rel.startsWith('modules/Users/features/')
    || rel.startsWith('modules/Users/composition/')
    || rel.startsWith('modules/Users/service/')
    || rel.startsWith('modules/Users/events/')
    || rel === 'modules/Users/factories.test.ts'
    || rel === 'modules/Users/index.exports.test.ts'
  ) {
    return { layer: 'application', kind: 'hexagonal' };
  }
  if (rel.startsWith('modules/Users/adapters/in/') || rel.startsWith('modules/Users/interface/')) {
    return { layer: 'adapters/in', kind: 'hexagonal' };
  }
  if (rel.startsWith('interface/')) {
    return { layer: 'interface/runtime', kind: 'hexagonal' };
  }
  if (rel.startsWith('infra/') || rel.startsWith('modules/Users/adapters/out/')) {
    return { layer: 'adapters/out+infra', kind: 'hexagonal' };
  }
  // Service Management is a declared non-hexagonal kind (JUM-552), not tooling:
  // lumping it into `tooling` meant a ci-cd change ran the SM designer suites and
  // an SM change did not. Its unit suites cover the designer SPA (state, store,
  // validation, exporters), so they belong to the designer sub-layer (JUM-472).
  if (rel.startsWith('service-management/')) {
    return { layer: 'service-management/designer', kind: 'non-hexagonal' };
  }
  if (
    rel.startsWith('ci-cd/')
    || rel.startsWith('config/')
    || rel.startsWith('shared/')
    || rel.startsWith('sdk-clients/')
    || rel.startsWith('packages/')
    || rel.startsWith('domains/')
  ) {
    return { layer: 'tooling', kind: 'non-hexagonal' };
  }
  if (rel.startsWith('modules/')) return { layer: 'application', kind: 'hexagonal' };
  return { layer: 'tooling', kind: 'non-hexagonal' };
}

/**
 * Which Service Management sub-layer each integration suite covers (JUM-472).
 *
 * Enumerated, not derived from a pattern: JUM-552 forbids a wildcard catch-all,
 * so a new SM integration suite has no area until it is named here — and the
 * generator refuses to guess (a wrong guess puts the suite in the wrong
 * selection set, where it runs for changes that cannot affect it and stays
 * silent for the ones that can). Adding a suite is one line in this map plus
 * `bun run test-map:generate`.
 */
const SERVICE_MANAGEMENT_INTEGRATION_AREA = {
  'domainDesigner.smoke.test.ts': 'service-management/designer',
  'pwaShell.browser.integration.test.ts': 'service-management/designer',
  'spaBoot.browser.integration.test.ts': 'service-management/designer',
  'firstRun.browser.integration.test.ts': 'service-management/designer',
  'canaMigration.browser.integration.test.ts': 'service-management/designer',
  'multiTabSync.browser.integration.test.ts': 'service-management/designer',
  'deployTargetLifecycle.browser.integration.test.ts': 'service-management/designer',
  'offlinePersistenceMatrix.browser.integration.test.ts': 'service-management/designer',
  'interfaceAdapters.browser.integration.test.ts': 'service-management/designer',
  'runtimeEnv.integration.test.ts': 'service-management/server',
  'runtimeEnvContract.integration.test.ts': 'service-management/server',
  'pm2Ecosystem.integration.test.ts': 'service-management/server',
  'staticManifest.integration.test.ts': 'service-management/server',
  'staticServing.integration.test.ts': 'service-management/server'
};

function classifyIntegration(file) {
  const parts = file.split('/');
  const idx = parts.indexOf('integration');
  const bucket = parts[idx + 1] || 'unknown';
  // Service Management is a declared non-hexagonal kind with its own internal
  // structure (JUM-552/JUM-472): server suites and designer-SPA suites live in
  // separate sub-layers so a `server.js` change and a `script.js` change do not
  // drag each other's unit suites along. Filing it under `interface/runtime`
  // made every SM change run the whole backend interface layer instead.
  if (bucket === 'ServiceManagement') {
    const area = SERVICE_MANAGEMENT_INTEGRATION_AREA[parts[parts.length - 1]];
    if (!area) {
      throw new Error(
        `Service Management integration suite with no recorded area: ${file}\n`
          + '  Name it in SERVICE_MANAGEMENT_INTEGRATION_AREA (ci-cd/generate-test-map.js)'
          + '  — service-management/server or service-management/designer — and regenerate.'
      );
    }
    return {
      layer: area,
      kind: 'non-hexagonal',
      adapter: 'service-management',
      script: 'test:integration:service-management'
    };
  }
  const map = {
    Express: { layer: 'adapters/in', adapter: 'express', script: 'test:integration:express' },
    Fastify: { layer: 'adapters/in', adapter: 'fastify', script: 'test:integration:fastify' },
    Restify: { layer: 'adapters/in', adapter: 'restify', script: 'test:integration:restify' },
    Lambda: { layer: 'adapters/in', adapter: 'lambda', script: 'test:integration:lambda' },
    'Cloudflare-Workers': {
      layer: 'adapters/in',
      adapter: 'cloudflare-workers',
      script: 'test:integration:cloudflare-workers'
    },
    'Vercel-Functions': {
      layer: 'adapters/in',
      adapter: 'vercel-functions',
      script: 'test:integration:vercel-functions'
    },
    LoopBack: { layer: 'adapters/in', adapter: 'loopback', script: 'test:integration:loopback' },
    'Sails-JS': { layer: 'adapters/in', adapter: 'sails-js', script: 'test:integration:sails-js' },
    Feathers: { layer: 'adapters/in', adapter: 'feathers', script: 'test:integration:feathers' },
    'Derby-JS': { layer: 'adapters/in', adapter: 'derby-js', script: 'test:integration:derby-js' },
    'Adonis-JS': { layer: 'adapters/in', adapter: 'adonis-js', script: 'test:integration:adonis-js' },
    'Total-JS': { layer: 'adapters/in', adapter: 'total-js', script: 'test:integration:total-js' },
    realtime: { layer: 'interface/runtime', adapter: 'realtime', script: 'test:integration:realtime' },
    mutex: {
      layer: 'adapters/out+infra',
      adapter: 'mutex',
      script: 'test:integration:mutex',
      ciRunner: 'node'
    }
  };
  return map[bucket] || {
    layer: 'adapters/in',
    adapter: String(bucket).toLowerCase(),
    script: null
  };
}

/** Every `*.test.ts` under `packages/<name>/test/`, repository-relative. */
function packageSuitePaths(root) {
  const packagesRoot = path.join(root, PACKAGES_DIR);
  if (!fs.existsSync(packagesRoot)) return [];

  return fs.readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => walk(
      path.join(packagesRoot, entry.name, 'test'),
      (file) => /\.test\.ts$/.test(file)
    ))
    .map((file) => path.relative(root, file).replace(/\\/g, '/'))
    .sort(byPath);
}

/** Every `*.cy.ts` spec under `packages/cana/cypress/`, repository-relative. */
function browserSpecPaths(root) {
  return walk(
    path.join(root, PACKAGES_DIR, 'cana', 'cypress'),
    (file) => /\.cy\.ts$/.test(file)
  )
    .map((file) => path.relative(root, file).replace(/\\/g, '/'))
    .sort(byPath);
}

function readPreviousManifest(root) {
  const previousPath = path.join(root, 'test-map.json');
  if (!fs.existsSync(previousPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(previousPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Runner pins carried across from the committed manifest.
 *
 * `reason` is part of the pin, not commentary. Requirement 110 honours
 * `runner: "node"` only when a reason is stated — `mapPinsToNode` tests
 * `Boolean(suite.reason)` — so dropping the text silently downgrades the pin to
 * a preference and the suite goes back to the default runner.
 *
 * That was not hypothetical: this map carries twenty-two suites pinned to Node
 * because Bun cannot load restify at all (it pulls spdy -> handle-thing ->
 * `process.binding('stream_wrap')`, oven-sh/bun#4957). Regenerating reset every
 * one of them to `runner: "bun"` and deleted the reason — so the next run would
 * have tried to start restify under Bun, where it cannot even be imported.
 */
function loadPreviousRunnerOverrides(root, previous = readPreviousManifest(root)) {
  const overrides = new Map();
  for (const suite of previous?.suites || []) {
    if (suite.path && suite.runner) {
      overrides.set(suite.path, {
        runner: suite.runner,
        ciRunner: suite.ciRunner,
        bunCompat: suite.bunCompat,
        reason: suite.reason
      });
    }
  }
  return overrides;
}

/**
 * Prior classification for a workspace package's suites, keyed by path.
 *
 * Suites under `apps/backend-template/test/` are classified from their path:
 * the directory layout encodes the hexagonal layer. Nothing under
 * `packages/<name>/test/` does — `packages/cana/test/storage.test.ts` says which
 * package it belongs to and nothing about which layer, and two packages can sit
 * in different layers with identical layouts.
 *
 * So a package suite's `layer`, `kind` and `timeoutMs` are carried across from
 * the committed manifest rather than inferred. Three of cana's eighteen carry a
 * hand-raised 120s timeout; a generator that re-derived them would quietly reset
 * those to the default and the affected suites would start timing out in CI for
 * no reason anyone could trace to this file.
 */
function loadPackageSuiteClassification(root, previous = readPreviousManifest(root)) {
  const classification = new Map();
  for (const suite of previous?.suites || []) {
    if (suite.path?.startsWith(`${PACKAGES_DIR}/`)) {
      classification.set(suite.path, suite);
    }
  }
  return classification;
}

function buildManifest(root = process.cwd()) {
  const unitTests = walk(
    path.join(root, 'apps/backend-template/test/unit'),
    (p) => /\.test\.ts$/.test(p)
  ).map((p) => path.relative(root, p).replace(/\\/g, '/'));
  const integrationTests = walk(
    path.join(root, 'apps/backend-template/test/integration'),
    (p) => /\.test\.ts$/.test(p)
  ).map((p) => path.relative(root, p).replace(/\\/g, '/'));
  const smokeTests = walk(
    path.join(root, 'apps/backend-template/test/smoke'),
    (p) => /\.test\.ts$/.test(p)
  ).map((p) => path.relative(root, p).replace(/\\/g, '/'));

  // Requirement 112 gives every package its own suite, so the generator has to
  // see them. It did not: it walked three fixed directories under
  // `apps/backend-template/test/` and nothing else, which meant regenerating the
  // map deleted all eighteen of cana's entries — 214 suites in, 195 out, with no
  // error. The map is what `run-unit-tests.js` builds its target list from, so
  // the deletion would not have surfaced as a failure either; those suites would
  // simply have stopped running.
  const packageTests = packageSuitePaths(root);

  const previousManifest = readPreviousManifest(root);
  const previousOverrides = loadPreviousRunnerOverrides(root, previousManifest);
  const packageClassification = loadPackageSuiteClassification(root, previousManifest);

  const layers = {
    contracts: {
      dependsOn: [],
      // `spec/` holds the canonical OAS/AsyncAPI contract artifacts the designer
      // emits and the boilerplate consumes. Mapping them to the contracts layer
      // is what lets a contract-shape change reach every dependent layer — the
      // service-management sub-layers included — through reverse dependencies,
      // even though no importer edge can exist against a YAML file (JUM-472).
      sourceGlobs: ['packages/*/src/contracts/**', 'packages/persistence-contracts/src/**', 'spec/**'],
      runner: 'bun',
      tier: 'gate'
    },
    domain: {
      dependsOn: ['contracts'],
      sourceGlobs: [
        'apps/backend-template/src/modules/*/domain/**',
        'apps/backend-template/src/domains/**'
      ],
      runner: 'bun',
      tier: 'gate'
    },
    application: {
      dependsOn: ['domain'],
      sourceGlobs: [
        'apps/backend-template/src/modules/*/application/**',
        'apps/backend-template/src/modules/*/service/**',
        'apps/backend-template/src/modules/*/composition/**',
        'apps/backend-template/src/modules/*/events/**',
        'apps/backend-template/src/modules/*/features/**'
      ],
      runner: 'bun',
      tier: 'gate'
    },
    'adapters/out+infra': {
      dependsOn: ['application'],
      sourceGlobs: [
        'apps/backend-template/src/infra/**',
        'apps/backend-template/src/modules/*/adapters/out/**',
        'packages/*/src/**'
      ],
      runner: 'bun',
      tier: 'gate'
    },
    'adapters/in': {
      dependsOn: ['application'],
      sourceGlobs: [
        'apps/backend-template/src/modules/*/adapters/in/**',
        'apps/backend-template/src/interface/HTTP/adapters/**'
      ],
      runner: 'node',
      tier: 'gate'
    },
    'interface/runtime': {
      dependsOn: ['adapters/in', 'adapters/out+infra'],
      sourceGlobs: [
        'apps/backend-template/src/interface/**'
      ],
      runner: 'node',
      tier: 'gate'
    },
    // Service Management is a zero-build vanilla SPA plus a dependency-free Node
    // static server: no domain, no application layer, no adapters. JUM-552
    // registers it as a declared non-hexagonal kind instead of forcing the
    // six-layer model onto it, split into its two real parts (JUM-472): the
    // server and the designer SPA it serves. The designer depends on the server
    // (it is served by it and calls its runtime API), so a server change runs
    // the whole component while designer iteration runs only the designer
    // suites. Globs are enumerated per JUM-552 — a new file at the app root maps
    // to no layer and turns the gate red until it is classified here.
    'service-management/server': {
      dependsOn: ['contracts'],
      sourceGlobs: [
        'apps/service-management/server.js',
        'apps/service-management/package.json'
      ],
      runner: 'bun',
      tier: 'gate',
      kind: 'non-hexagonal'
    },
    'service-management/designer': {
      dependsOn: ['service-management/server'],
      sourceGlobs: [
        'apps/service-management/script.js',
        'apps/service-management/src/**',
        'apps/service-management/index.html',
        'apps/service-management/styles.css'
      ],
      runner: 'bun',
      tier: 'gate',
      kind: 'non-hexagonal'
    },
    // JUM-622. Cana's real coverage is eighteen Cypress specs running in a real
    // browser (JUM-586 replaced the fake-indexeddb suites with them). None of
    // them were in this manifest, and `packages/cana/cypress/**` matches no
    // layer's globs — so a change confined to the harness mapped to nothing and
    // the task gate refused the whole change set as `unsupported-change-set`.
    // That is the gate failing closed, which is right; what was wrong is that a
    // 294-test suite was unreachable by the selector that decides what runs.
    //
    // `dependsOn: []` is deliberate. Blast radius is outward, so a layer listed
    // as depending on `adapters/out+infra` would drag a full browser run into
    // every backend infra change. These specs exercise cana's IndexedDB engine
    // and nothing else; the only changes that can affect them are cana's own.
    'browser-harness': {
      dependsOn: [],
      //
      // JUM-623: the harness is not all in one directory. Specs are authored
      // under `packages/cana/cypress/`, compiled to `.browser-tests/`, and run
      // against a support file and a config that live at the repository root.
      // Registering only the spec directory left `cypress/support/e2e.js` and
      // `cypress.config.js` — the two files every spec depends on — mapping to
      // no layer, so the change set JUM-622 set out to unblock was still
      // refused.
      sourceGlobs: [
        'packages/cana/cypress/**',
        'packages/cana/src/**',
        'cypress/**',
        'cypress.config.js'
      ],
      runner: 'bun',
      tier: 'gate',
      kind: 'non-hexagonal'
    },
    tooling: {
      dependsOn: [],
      // Pipeline definitions and root tooling configuration belong to this layer.
      // Without them a change touching only `.circleci/config.yml` or
      // `test-map.json` maps to no layer and no suite, and the task gate refuses
      // it as an `unsupported-change-set` — correct for a file nobody can
      // classify, wrong for the configuration that drives the gates themselves.
      sourceGlobs: [
        'ci-cd/**',
        'tooling/**',
        'apps/jumentix-website/**',
        '.github/**',
        '.circleci/**',
        'test-map.json',
        'jest.config.js',
        'sonar-project.properties',
        'package.json',
        'bunfig.toml'
      ],
      runner: 'bun',
      tier: 'gate',
      kind: 'non-hexagonal'
    }
  };

  const suites = [];
  for (const file of unitTests) {
    const { layer, kind } = classifyUnit(file);
    const previous = previousOverrides.get(file) || {};
    // Req 106: local runner is always bun; optional ciRunner retained for CI-only Node.
    const ciRunner = previous.ciRunner || (previous.runner === 'node' ? 'node' : undefined);
    suites.push({
      id: file,
      path: file,
      layer,
      kind,
      type: 'unit',
      runner: 'bun',
      ...(ciRunner ? { ciRunner } : {}),
      ...(previous.bunCompat ? { bunCompat: previous.bunCompat } : {}),
      tier: 'gate',
      timeoutMs: 60_000
    });
  }
  for (const file of integrationTests) {
    const meta = classifyIntegration(file);
    const isNightly = meta.adapter === 'mutex'
      || file.includes('redis-streams.multi-instance');
    // The pin is preserved here too. It used to be read only for unit suites,
    // while every Node-pinned suite in this map is an integration one — so the
    // preservation covered the case that never needed it and missed the case
    // that did.
    const previous = previousOverrides.get(file) || {};
    suites.push({
      id: file,
      path: file,
      layer: meta.layer,
      kind: meta.kind || 'hexagonal',
      type: 'integration',
      adapter: meta.adapter,
      script: meta.script,
      runner: previous.runner === 'node' ? 'node' : 'bun',
      ciRunner: previous.ciRunner || meta.ciRunner || 'node',
      ...(previous.reason ? { reason: previous.reason } : {}),
      tier: isNightly ? 'nightly' : 'gate',
      timeoutMs: ['express', 'fastify'].includes(meta.adapter)
        ? 300_000
        : meta.adapter === 'restify'
          ? 600_000
          : 120_000
    });
  }
  for (const file of smokeTests) {
    suites.push({
      id: file,
      path: file,
      layer: 'adapters/out+infra',
      kind: 'hexagonal',
      type: 'smoke',
      runner: 'bun',
      ciRunner: 'node',
      tier: 'nightly',
      timeoutMs: 180_000
    });
  }

  // Package suites keep the classification the manifest already records. A new
  // one has none, and there is no path convention to derive it from, so it is
  // reported rather than guessed: a wrong layer puts the suite in the wrong
  // selection set, where it runs for changes that cannot affect it and stays
  // silent for the ones that can.
  const unclassified = [];
  for (const file of packageTests) {
    const previous = packageClassification.get(file);
    if (!previous) {
      unclassified.push(file);
      continue;
    }
    suites.push({ ...previous, id: file, path: file });
  }

  if (unclassified.length > 0) {
    throw new Error(
      'Package suites with no recorded classification:\n'
        + unclassified.map((file) => `  - ${file}`).join('\n')
        + '\n\n  Suites under apps/backend-template/test/ are classified from their path;'
        + '\n  nothing under packages/*/test/ encodes a layer. Add the entry to'
        + '\n  test-map.json by hand — layer, kind, type, runner, tier, timeoutMs — and'
        + '\n  this generator will carry it forward from then on.'
    );
  }

  // Browser specs (JUM-622). Enumerated rather than carried across like package
  // suites: `packages/cana/cypress/*.cy.ts` *does* encode its classification —
  // every file in that directory is a browser spec of the same layer — so there
  // is nothing to guess and a new spec is picked up without a hand edit.
  //
  // They share one script. Eighteen suites resolve to a single `test:browser`
  // invocation because `createLayerAwarePlan` de-duplicates integration scripts;
  // registering them individually is what makes each spec visible to the
  // manifest checks and to coverage, not eighteen Cypress runs.
  for (const file of browserSpecPaths(root)) {
    suites.push({
      id: file,
      path: file,
      layer: 'browser-harness',
      kind: 'non-hexagonal',
      type: 'integration',
      adapter: 'cypress',
      script: 'test:browser',
      runner: 'bun',
      ciRunner: 'node',
      tier: 'gate',
      timeoutMs: 300_000
    });
  }

  // Contract layer (JUM-440) — governance checks promoted to first-class suites.
  for (const contract of [
    {
      id: 'contract:oas-routes',
      path: 'ci-cd/check-oas-route-resolution.js',
      script: 'oas:check-routes'
    },
    {
      id: 'contract:serverless-handlers',
      path: 'ci-cd/check-serverless-handler-paths.js',
      script: 'serverless:check-handlers'
    }
  ]) {
    suites.push({
      id: contract.id,
      path: contract.path,
      layer: 'contracts',
      kind: 'governance',
      type: 'contract',
      script: contract.script,
      runner: 'bun',
      tier: 'gate',
      timeoutMs: 120_000
    });
  }

  return {
    schemaVersion: 1,
    description: 'Hexagonal Test Pyramid manifest — Bun unit + Node integration + layer-aware gates',
    layers,
    blastRadius: 'outward',
    suites,
    // Carried across, not reset. A quarantine entry records a suite that is
    // knowingly not gating, with an issue and a reason; regenerating the map
    // would have silently un-quarantined it and put a known-flaky suite back in
    // front of every commit — the same class of loss as dropping the package
    // suites, in the opposite direction.
    quarantine: previousManifest?.quarantine || [],
    sourceRoots: [
      'apps/backend-template/src',
      'apps/backend-template/test',
      'apps/service-management',
      'apps/jumentix-website',
      'packages',
      'ci-cd',
      'tooling'
    ],
    pathAliases: {
      '@src': 'apps/backend-template/src',
      '@test': 'apps/backend-template/test',
      '@seed': 'apps/backend-template/seed',
      '@jumentix': 'packages'
    },
    gateTable: {
      task: { script: 'ci:gate:task', mode: 'layer-aware' },
      dev: { script: 'test:unit', mode: 'full-unit+contract' },
      main: { script: 'ci:gate:strict', mode: 'full-matrix' }
    },
    flags: {
      gateV2Env: 'JUMENTIX_GATE_V2',
      gateV2Default: true,
      shadowEnv: 'JUMENTIX_GATE_V2_SHADOW'
    },
    stats: {
      // Package suites are unit suites and count as such: the committed manifest
      // records them with `type: "unit"`, and a total that omitted them would
      // disagree with the entries it summarises.
      unit: unitTests.length + packageTests.length,
      integration: integrationTests.length,
      smoke: smokeTests.length,
      suites: suites.length
    }
  };
}

function main() {
  const root = path.resolve(__dirname, '..');
  const manifest = buildManifest(root);
  const outPath = path.join(root, 'test-map.json');
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[ci] wrote ${outPath}`);
  console.log(`[ci] suites=${manifest.stats.suites} unit=${manifest.stats.unit} integration=${manifest.stats.integration} smoke=${manifest.stats.smoke}`);
}

if (isEntryPoint(module)) {
  main();
}

module.exports = {
  SERVICE_MANAGEMENT_INTEGRATION_AREA,
  buildManifest,
  classifyIntegration,
  classifyUnit,
  loadPackageSuiteClassification,
  loadPreviousRunnerOverrides,
  packageSuitePaths,
  readPreviousManifest,
  walk
};
