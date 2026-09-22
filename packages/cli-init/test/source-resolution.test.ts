/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AddressInfo } from 'node:net';

require('./ensure-built');

const fixturesDir = path.join(__dirname, '..', 'fixtures');

const {
  resolveSources,
  validateGenerationPlan,
  SourceResolutionError,
  SOURCE_MESSAGES,
  loadOasSource,
  loadDesignerExportSource,
  loadCatalogSource,
  loadPresetSource,
  buildPlanFromOasDocument
} = require('../dist/sources');

const { main } = require('../dist/cli');

function fixture(...parts: string[]): string {
  return path.join(fixturesDir, ...parts);
}

type PlanEntity = {
  name: string;
  primaryKey: string;
  relations: Array<{ entity: string }>;
};

type PlanDomain = {
  id: string;
  entities: PlanEntity[];
};

function entityNames(plan: { domains: PlanDomain[] }): string[] {
  return plan.domains.flatMap((domain) => domain.entities.map((entity) => entity.name));
}

function findEntity(plan: { domains: PlanDomain[] }, name: string): PlanEntity | undefined {
  return plan.domains
    .flatMap((domain) => domain.entities)
    .find((entity) => entity.name === name);
}

describe('source resolution — users preset (JUM-846)', () => {
  it('loads --preset users into a monolith GenerationPlan with core service', async () => {
    expect.hasAssertions();
    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml')
    });
    expect(plan.mode).toBe('monolith');
    expect(plan.services).toHaveLength(1);
    expect(plan.services[0].kind).toBe('core');
    expect(plan.domains.length).toBeGreaterThan(0);
    expect(entityNames(plan)).toContain('User');
  });

  it('users preset entities carry primary keys and relations', async () => {
    expect.hasAssertions();
    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml')
    });
    expect(entityNames(plan)).toContain('Organization');
    expect(plan.contracts.oasPerService.core).toBeTruthy();
    const user = findEntity(plan, 'User');
    expect(user?.primaryKey).toBe('id');
    expect(user?.relations.some((rel) => rel.entity === 'Organization')).toBe(true);
  });

  it('defaults to users preset when --from is omitted', async () => {
    expect.hasAssertions();
    const plan = await loadPresetSource('users', {
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    }, fixture('users-oas.yml'));
    expect(plan.services[0].id).toBe('core');
  });
});

describe('source resolution — OAS file (JUM-846)', () => {
  it('loads a local OAS fixture into a GenerationPlan', async () => {
    expect.hasAssertions();
    const plan = await loadOasSource(fixture('users-oas.yml'), {
      http: 'fastify',
      realtime: 'none',
      db: 'postgres'
    });
    expect(plan.services[0].interfaces.http).toBe('fastify');
    expect(plan.services[0].db).toBe('postgres');
    expect(Object.keys(plan.contracts.oasPerService)).toContain('core');
  });
});

describe('source resolution — designer export (JUM-846)', () => {
  it('loads a designer suite export fixture into a GenerationPlan', async () => {
    expect.hasAssertions();
    const plan = await loadDesignerExportSource(fixture('designer-export.json'), {
      http: 'express',
      realtime: 'websocket',
      db: 'sqlite'
    });
    expect(plan.mode).toBe('monolith');
    expect(plan.services[0].kind).toBe('core');
    expect(plan.services[0].interfaces.realtime).toBe('websocket');
    expect(entityNames(plan)).toStrictEqual(
      expect.arrayContaining(['User', 'Organization'])
    );
  });

  it('designer export restores relationship edges on User', async () => {
    expect.hasAssertions();
    const plan = await loadDesignerExportSource(fixture('designer-export.json'), {
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });
    const user = findEntity(plan, 'User');
    expect(user?.relations.some((rel) => rel.entity === 'Organization')).toBe(true);
  });
});

describe('source resolution — catalog URL (JUM-846)', () => {
  it('fetches an OAS document from a catalog mock server', async () => {
    expect.hasAssertions();
    const body = fs.readFileSync(fixture('users-oas.yml'), 'utf8');
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/yaml' });
      res.end(body);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    const plan = await loadCatalogSource(`http://127.0.0.1:${port}/catalog/users`, {
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    expect(plan.services[0].kind).toBe('core');
    expect(plan.domains.length).toBeGreaterThan(0);
  });
});

describe('source resolution — validation (JUM-846)', () => {
  it('rejects entity without primary key with named message and exit 1', async () => {
    expect.hasAssertions();
    let caught: unknown;
    try {
      await resolveSources({ from: fixture('invalid-no-primary-key.yml') });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SourceResolutionError);
    const err = caught as InstanceType<typeof SourceResolutionError>;
    expect(err.exitCode).toBe(1);
    expect(err.message).toContain('has no primary key');
    expect(err.message).toContain('Widget');
  });

  it('rejects architecture with no core service', async () => {
    expect.hasAssertions();
    let caught: unknown;
    try {
      await resolveSources({ from: fixture('invalid-no-core.yml') });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SourceResolutionError);
    expect((caught as Error).message).toBe(SOURCE_MESSAGES.NO_CORE_SERVICE);
  });

  it('rejects duplicate entity names across domains', async () => {
    expect.hasAssertions();
    let caught: unknown;
    try {
      await resolveSources({ from: fixture('invalid-duplicate-entity.yml') });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SourceResolutionError);
    expect((caught as Error).message).toContain('duplicate entity name "User"');
  });

  it('rejects unsupported http interface', async () => {
    expect.hasAssertions();
    const plan = await loadOasSource(fixture('users-oas.yml'), {
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });
    plan.services[0].interfaces.http = 'koa' as 'express';
    expect(() => validateGenerationPlan(plan)).toThrow(/unsupported http interface "koa"/);
  });

  it('rejects relation crossing service boundary in monolith mode', async () => {
    expect.hasAssertions();
    const plan = await loadOasSource(fixture('users-oas.yml'), {
      http: 'express',
      realtime: 'none',
      db: 'sqlite',
      mode: 'monolith'
    });
    const usersDomain = plan.domains[0];
    const orgEntity = findEntity(plan, 'Organization');
    expect(orgEntity).toBeTruthy();
    plan.domains.push({
      id: 'domain-billing',
      name: 'Billing',
      entities: [orgEntity]
    });
    usersDomain.entities = usersDomain.entities.filter(
      (entity: PlanEntity) => entity.name !== 'Organization'
    );
    plan.services.push({
      id: 'billing',
      kind: 'domain',
      domains: ['domain-billing'],
      interfaces: { http: 'express', realtime: 'none' },
      db: 'sqlite'
    });
    plan.services[0].domains = [usersDomain.id];
    expect(() => validateGenerationPlan(plan)).toThrow(/crosses service boundary/);
  });
});

describe('init CLI wires source resolution (JUM-846)', () => {
  it('init --preset users --non-interactive prints GenerationPlan summary', async () => {
    expect.hasAssertions();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-plan-'));
    const project = path.join(out, 'plan-only');
    try {
      const messages: string[] = [];
      const code = await main(
        [
          'init',
          '--non-interactive',
          '--preset=users',
          '--mode=services',
          `--project-name=${project}`
        ],
        (message = '') => {
          messages.push(message);
        }
      );
      expect(code).toBe(0);
      const text = messages.join('\n');
      expect(text).toContain('GenerationPlan resolved:');
      expect(text).toContain('mode:');
      expect(text).toContain('Backend generation wrote');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('init --from invalid fixture exits 1 with named message', async () => {
    expect.hasAssertions();
    const messages: string[] = [];
    const code = await main(
      [
        'init',
        '--non-interactive',
        `--from=${fixture('invalid-no-core.yml')}`,
        '--project-name=bad'
      ],
      (message = '') => {
        messages.push(message);
      }
    );
    expect(code).toBe(1);
    expect(messages.join('\n')).toContain(SOURCE_MESSAGES.NO_CORE_SERVICE);
  });
});

describe('mode inference (JUM-846)', () => {
  it('infers monolith for a single-service OAS when --mode is omitted', async () => {
    expect.hasAssertions();
    const raw = fs.readFileSync(fixture('users-oas.yml'), 'utf8');
    const doc = parseYaml(raw) as Record<string, unknown>;
    const plan = await buildPlanFromOasDocument(doc, {
      http: 'express',
      realtime: 'none',
      db: 'sqlite'
    });
    expect(plan.mode).toBe('monolith');
  });
});
