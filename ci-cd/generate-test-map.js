/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

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
  if (
    rel.startsWith('ci-cd/')
    || rel.startsWith('config/')
    || rel.startsWith('shared/')
    || rel.startsWith('sdk-clients/')
    || rel.startsWith('service-management/')
    || rel.startsWith('packages/')
    || rel.startsWith('domains/')
  ) {
    return { layer: 'tooling', kind: 'non-hexagonal' };
  }
  if (rel.startsWith('modules/')) return { layer: 'application', kind: 'hexagonal' };
  return { layer: 'tooling', kind: 'non-hexagonal' };
}

function classifyIntegration(file) {
  const parts = file.split('/');
  const idx = parts.indexOf('integration');
  const bucket = parts[idx + 1] || 'unknown';
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
    ServiceManagement: {
      layer: 'interface/runtime',
      adapter: 'service-management',
      script: 'test:integration:service-management'
    },
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

function loadPreviousRunnerOverrides(root) {
  const previousPath = path.join(root, 'test-map.json');
  if (!fs.existsSync(previousPath)) return new Map();
  try {
    const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
    const overrides = new Map();
    for (const suite of previous.suites || []) {
      if (suite.path && suite.runner) {
        overrides.set(suite.path, {
          runner: suite.runner,
          ciRunner: suite.ciRunner,
          bunCompat: suite.bunCompat
        });
      }
    }
    return overrides;
  } catch {
    return new Map();
  }
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
  const previousOverrides = loadPreviousRunnerOverrides(root);

  const layers = {
    contracts: {
      dependsOn: [],
      sourceGlobs: ['packages/*/src/contracts/**', 'packages/persistence-contracts/src/**'],
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
        'apps/backend-template/src/interface/**',
        'apps/service-management/**'
      ],
      runner: 'node',
      tier: 'gate'
    },
    tooling: {
      dependsOn: [],
      sourceGlobs: ['ci-cd/**', 'tooling/**', 'apps/jumentix-website/**'],
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
    suites.push({
      id: file,
      path: file,
      layer: meta.layer,
      kind: 'hexagonal',
      type: 'integration',
      adapter: meta.adapter,
      script: meta.script,
      runner: 'bun',
      ciRunner: meta.ciRunner || 'node',
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
    quarantine: [],
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
      unit: unitTests.length,
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

if (require.main === module) {
  main();
}

module.exports = {
  buildManifest,
  classifyIntegration,
  classifyUnit,
  walk
};
