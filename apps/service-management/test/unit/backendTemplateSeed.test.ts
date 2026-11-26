/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/* eslint-disable jest/no-conditional-in-test, max-len, @typescript-eslint/no-require-imports */

/**
 * Backend-template seed — first-run model generated from spec/1.0.0.yml.
 *
 * Pins:
 * - Generator writes a Users domain with stable ids across two runs.
 * - Normalized seed has zero collectModelIssues (export gate).
 * - Vendor script chain references the generator.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { normalizeStatePayload } from '@jumentix/designer-core/state/designerState.js';
import { collectModelIssues } from '@jumentix/designer-core/validation/modelValidation.js';
import {
  generateBackendTemplateSeed,
  listDomainModules,
  collectOasDomainNames,
  assertModuleDomainsInOas,
  stampSchemaDomainsFromModules,
  isPortLikeSchema,
  stabilizeSeedIds,
  buildEmbedModule,
  OUT_JSON_REL,
  OUT_META_REL,
  OUT_EMBED_REL
} from '../../scripts/generate-backend-template-seed.js';
import { buildBackendTemplateSeedPayload } from '../../src/model/backendTemplateSeed.js';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('backend-template seed', () => {
  it('generates a Users domain with deterministic ids across two runs', () => {
    expect.hasAssertions();
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-seed-'));
    try {
      // Mirror the OAS + Users module layout the generator expects.
      const specDir = path.join(tempRoot, 'spec');
      const modulesDir = path.join(tempRoot, 'apps', 'backend-template', 'src', 'modules', 'Users');
      fs.mkdirSync(specDir, { recursive: true });
      fs.mkdirSync(modulesDir, { recursive: true });
      fs.mkdirSync(
        path.join(tempRoot, 'apps', 'backend-template', 'src', 'modules', 'ddd'),
        { recursive: true }
      );
      fs.copyFileSync(
        path.join(repoRoot, 'spec', '1.0.0.yml'),
        path.join(specDir, '1.0.0.yml')
      );

      const code1 = generateBackendTemplateSeed({ root: tempRoot });
      expect(code1).toBe(0);
      const first = JSON.parse(
        fs.readFileSync(path.join(tempRoot, OUT_JSON_REL), 'utf8')
      );

      const code2 = generateBackendTemplateSeed({ root: tempRoot });
      expect(code2).toBe(0);
      const second = JSON.parse(
        fs.readFileSync(path.join(tempRoot, OUT_JSON_REL), 'utf8')
      );

      expect(first.domains.length).toBeGreaterThanOrEqual(1);
      expect(first.domains.some(
        (domain: { name: string }) => domain.name === 'Users'
      )).toBe(true);
      expect(first).toStrictEqual(second);
      expect(first.domains[0].id).toBe('backend-domain-users');
      expect(fs.existsSync(path.join(tempRoot, OUT_EMBED_REL))).toBe(true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('embeds a seed that normalizes with zero model issues', () => {
    expect.hasAssertions();
    const payload = buildBackendTemplateSeedPayload();
    expect(payload.domains.some(
      (domain: { name: string }) => domain.name === 'Users'
    )).toBe(true);
    const state = normalizeStatePayload(payload);
    expect(collectModelIssues(state)).toStrictEqual([]);
  });

  it('packs entity cards without overlap so relationships have corridor space', () => {
    expect.hasAssertions();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      entityWidth,
      entityHeight
    } = require('@jumentix/designer-core/model/modelQueries.js');
    const payload = buildBackendTemplateSeedPayload();
    const users = payload.domains.find(
      (domain: { name: string }) => domain.name === 'Users'
    );
    expect(users).toBeTruthy();
    const entities = users.entities as Array<{ x: number; y: number }>;
    expect(entities.length).toBeGreaterThanOrEqual(6);
    const boxes = entities.map((entity) => ({
      left: entity.x,
      top: entity.y,
      right: entity.x + entityWidth(entity),
      bottom: entity.y + entityHeight(entity, false, false)
    }));
    const header = 50;
    const pairs: Array<[typeof boxes[0], typeof boxes[0]]> = [];
    boxes.forEach((box, index) => {
      expect(box.right).toBeLessThanOrEqual(users.width - 56);
      // Entity y is body-relative — must fit under domain.height − header.
      expect(box.bottom).toBeLessThanOrEqual(users.height - header - 56);
      boxes.slice(index + 1).forEach((other) => {
        pairs.push([box, other]);
      });
    });
    pairs.forEach(([box, other]) => {
      const separatedX = box.right <= other.left || box.left >= other.right;
      const separatedY = box.bottom <= other.top || box.top >= other.bottom;
      expect(separatedX || separatedY).toBe(true);
    });
    // Prefer two columns so vertical corridors exist (not a side-only 3-col pack).
    const xs = new Set(entities.map((entity) => entity.x));
    expect(xs.size).toBeLessThanOrEqual(2);
  });

  it('is wired into service-management:vendor', () => {
    expect.hasAssertions();
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    );
    const vendor = String(packageJson.scripts['service-management:vendor']);
    expect(vendor).toContain('generate-backend-template-seed.js');
    expect(fs.existsSync(path.join(
      repoRoot,
      'apps/service-management/generated/backend-template-seed.json'
    ))).toBe(true);
  });
});

describe('backend-template seed helpers', () => {
  const entity = (extra: Record<string, unknown> = {}) => ({
    type: 'object',
    properties: { id: { type: 'string' } },
    ...extra
  });

  describe('isPortLikeSchema', () => {
    it('treats non-object values as ports', () => {
      expect.hasAssertions();
      expect(isPortLikeSchema('A', null)).toBe(true);
      expect(isPortLikeSchema('A', undefined)).toBe(true);
      expect(isPortLikeSchema('A', 'str')).toBe(true);
    });

    it('honors x-port-object, x-entity, and x-domain markers', () => {
      expect.hasAssertions();
      expect(isPortLikeSchema('A', entity({ 'x-port-object': true }))).toBe(true);
      expect(isPortLikeSchema('A', { 'x-entity': 'A' })).toBe(false);
      expect(isPortLikeSchema('A', { 'x-domain': 'D' })).toBe(false);
    });

    it('treats well-known DTO names and Request/ArrayOf patterns as ports', () => {
      expect.hasAssertions();
      expect(isPortLikeSchema('ResourceDeleteResponse', entity())).toBe(true);
      expect(isPortLikeSchema('EntityMetricsResponse', entity())).toBe(true);
      expect(isPortLikeSchema('RequestCreateUser', entity())).toBe(true);
      expect(isPortLikeSchema('UserArrayOf', entity())).toBe(true);
      expect(isPortLikeSchema('Requester', entity())).toBe(false);
    });

    it('classifies by description', () => {
      expect.hasAssertions();
      expect(isPortLikeSchema('A', entity({ description: 'Port input object for x' }))).toBe(true);
      expect(isPortLikeSchema('A', entity({ description: 'Port output object for X resource.' }))).toBe(false);
      expect(isPortLikeSchema('A', entity({ description: 'Port output object for list' }))).toBe(true);
      expect(isPortLikeSchema('A', entity({ description: 'A regular entity' }))).toBe(false);
    });

    it('requires an object type with a properties map', () => {
      expect.hasAssertions();
      expect(isPortLikeSchema('A', { type: 'string' })).toBe(true);
      expect(isPortLikeSchema('A', { type: 'object' })).toBe(true);
      expect(isPortLikeSchema('A', { properties: 'nope' })).toBe(true);
      expect(isPortLikeSchema('A', { properties: { id: {} } })).toBe(false);
    });
  });

  describe('listDomainModules', () => {
    it('returns [] when the modules directory is missing', () => {
      expect.hasAssertions();
      const missing = path.join(os.tmpdir(), `missing-${Date.now()}-${Math.random()}`);
      const readDir = jest.fn();
      expect(listDomainModules(missing, readDir)).toStrictEqual([]);
      expect(readDir).not.toHaveBeenCalled();
    });

    it('filters infra folders and files, and sorts names', () => {
      expect.hasAssertions();
      const entries = [
        { name: 'Users', isDirectory: () => true },
        { name: 'ddd', isDirectory: () => true },
        { name: 'port', isDirectory: () => true },
        { name: 'index.ts', isDirectory: () => false },
        { name: 'Billing', isDirectory: () => true }
      ];
      expect(listDomainModules(os.tmpdir(), () => entries)).toStrictEqual(['Billing', 'Users']);
    });
  });

  describe('stampSchemaDomainsFromModules', () => {
    it('returns stamped 0 when there are no schemas', () => {
      expect.hasAssertions();
      expect(stampSchemaDomainsFromModules(undefined, [])).toStrictEqual({ stamped: 0 });
      expect(stampSchemaDomainsFromModules({}, [])).toStrictEqual({ stamped: 0 });
      expect(stampSchemaDomainsFromModules({ components: {} }, [])).toStrictEqual({ stamped: 0 });
      expect(stampSchemaDomainsFromModules({ components: { schemas: 'x' } }, [])).toStrictEqual({ stamped: 0 });
    });

    it('defaults to Users when a Users module exists and core service', () => {
      expect.hasAssertions();
      const parsed = { components: { schemas: { User: entity(), RequestFoo: entity() } } };
      const result = stampSchemaDomainsFromModules(parsed, ['Billing', 'Users']);
      expect(result).toStrictEqual({ stamped: 1, defaultDomain: 'Users', defaultService: 'core' });
      expect(parsed.components.schemas.User).toMatchObject({
        'x-domain': 'Users', 'x-service': 'core', 'x-entity': 'User'
      });
      expect(parsed.components.schemas.RequestFoo).not.toHaveProperty('x-domain');
    });

    it('falls back to the first module, then Imported', () => {
      expect.hasAssertions();
      const first = stampSchemaDomainsFromModules(
        { components: { schemas: { A: entity() } } },
        ['Billing', 'Orders']
      );
      expect(first.defaultDomain).toBe('Billing');
      const none = stampSchemaDomainsFromModules({ components: { schemas: { A: entity() } } }, []);
      expect(none.defaultDomain).toBe('Imported');
    });

    it('uses the first x-services id when provided', () => {
      expect.hasAssertions();
      const withId = stampSchemaDomainsFromModules({
        'x-services': [{ id: 'gateway' }],
        components: { schemas: { A: entity() } }
      }, []);
      expect(withId.defaultService).toBe('gateway');
      const noId = stampSchemaDomainsFromModules({
        'x-services': [{}],
        components: { schemas: { A: entity() } }
      }, []);
      expect(noId.defaultService).toBe('core');
      const empty = stampSchemaDomainsFromModules({
        'x-services': [],
        components: { schemas: { A: entity() } }
      }, []);
      expect(empty.defaultService).toBe('core');
    });

    it('preserves existing x-domain, x-service, and x-entity; stamps blanks', () => {
      expect.hasAssertions();
      const parsed = {
        components: {
          schemas: {
            Keep: entity({ 'x-domain': 'Mine', 'x-service': 'svc', 'x-entity': 'Custom' }),
            Blank: entity({ 'x-domain': '  ', 'x-service': ' ', 'x-entity': ' ' })
          }
        }
      };
      const result = stampSchemaDomainsFromModules(parsed, ['Users']);
      expect(result.stamped).toBe(1);
      expect(parsed.components.schemas.Keep).toMatchObject({
        'x-domain': 'Mine', 'x-service': 'svc', 'x-entity': 'Custom'
      });
      expect(parsed.components.schemas.Blank).toMatchObject({
        'x-domain': 'Users', 'x-service': 'core', 'x-entity': 'Blank'
      });
    });
  });

  describe('collectOasDomainNames / assertModuleDomainsInOas', () => {
    it('collects trimmed non-empty x-domain values', () => {
      expect.hasAssertions();
      expect(collectOasDomainNames(undefined).size).toBe(0);
      expect(collectOasDomainNames({ components: { schemas: 'x' } }).size).toBe(0);
      const names = collectOasDomainNames({
        components: {
          schemas: {
            A: { 'x-domain': ' Users ' }, B: { 'x-domain': '' }, C: null, D: {}
          }
        }
      });
      expect([...names]).toStrictEqual(['Users']);
    });

    it('passes silently when every module is present', () => {
      expect.hasAssertions();
      const logger = { error: jest.fn() };
      expect(assertModuleDomainsInOas(['Users'], new Set(['Users']), logger)).toBe(true);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('logs and fails when a module domain is missing from the OAS', () => {
      expect.hasAssertions();
      const logger = { error: jest.fn() };
      expect(assertModuleDomainsInOas(['Users', 'Billing', 'Orders'], new Set(['Users']), logger)).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Billing, Orders'));
    });
  });

  describe('stabilizeSeedIds', () => {
    it('handles missing domains, relationships, and architecture', () => {
      expect.hasAssertions();
      expect(stabilizeSeedIds({})).toStrictEqual({});
      expect(stabilizeSeedIds({ domains: 'x' as any })).toStrictEqual({ domains: 'x' });
      const payload = stabilizeSeedIds({ domains: [], relationships: [], architecture: {} });
      expect(payload).toStrictEqual({ domains: [], relationships: [], architecture: {} });
    });

    it('rewrites domain and entity ids, tolerating domains without entities', () => {
      expect.hasAssertions();
      const payload = stabilizeSeedIds({
        domains: [
          { id: 'd1', name: 'My Domain', entities: [{ id: 'e1', name: 'Some Entity' }] },
          { id: 'd2', name: '!!!' }
        ]
      });
      expect(payload.domains[0].id).toBe('backend-domain-my-domain');
      expect(payload.domains[0].entities[0].id).toBe('backend-entity-my-domain-some-entity');
      expect(payload.domains[1].id).toBe('backend-domain-item');
    });

    it('remaps relationship endpoints and leaves unknown endpoints intact', () => {
      expect.hasAssertions();
      const payload = stabilizeSeedIds({
        domains: [{ id: 'd1', name: 'Users', entities: [{ id: 'e1', name: 'User' }, { id: 'e2', name: 'Org' }] }],
        relationships: [
          {
            id: 'r1', name: 'User Org', fromEntityId: 'e1', toEntityId: 'e2'
          },
          {
            id: 'r2', fromEntityId: 'ghost-a', toEntityId: 'ghost-b'
          }
        ]
      });
      expect(payload.relationships[0]).toStrictEqual({
        id: 'backend-rel-user-org',
        name: 'User Org',
        fromEntityId: 'backend-entity-users-user',
        toEntityId: 'backend-entity-users-org'
      });
      expect(payload.relationships[1]).toMatchObject({
        id: 'backend-rel-item', fromEntityId: 'ghost-a', toEntityId: 'ghost-b'
      });
    });

    it('remaps architecture service domain ids, tolerating missing domain lists', () => {
      expect.hasAssertions();
      const payload = stabilizeSeedIds({
        domains: [{ id: 'd1', name: 'Users', entities: [] }],
        architecture: { services: [{ domains: ['d1', 'other'] }, {}] }
      });
      expect(payload.architecture.services[0].domains).toStrictEqual(['backend-domain-users', 'other']);
      expect(payload.architecture.services[1].domains).toStrictEqual([]);
    });

    it('ignores architecture without a services array', () => {
      expect.hasAssertions();
      const payload = stabilizeSeedIds({ domains: [], architecture: { services: 'x' as any } });
      expect(payload.architecture.services).toBe('x');
    });
  });

  describe('buildEmbedModule', () => {
    it('embeds the payload and meta', () => {
      expect.hasAssertions();
      const out = buildEmbedModule({ domains: [] }, { source: 'spec/x.yml', generatedAt: 'now' });
      expect(out).toContain('export function buildBackendTemplateSeedPayload()');
      expect(out).toContain('from spec/x.yml at now');
    });
  });
});

describe('generateBackendTemplateSeed injected', () => {
  const makeRoot = (moduleNames: string[] = ['Users']) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-seed-inj-'));
    const modulesDir = path.join(root, 'apps', 'backend-template', 'src', 'modules');
    fs.mkdirSync(modulesDir, { recursive: true });
    moduleNames.forEach((name) => fs.mkdirSync(path.join(modulesDir, name)));
    return root;
  };
  const makeLogger = () => ({ error: jest.fn(), log: jest.fn() });
  const cleanup = (root: string) => fs.rmSync(root, { recursive: true, force: true });
  const oas = () => ({
    components: { schemas: { User: { type: 'object', properties: { id: { type: 'string' } } } } }
  });

  it('fails when the OAS is missing', () => {
    expect.hasAssertions();
    const logger = makeLogger();
    expect(generateBackendTemplateSeed({ root: '/nope', exists: () => false, logger })).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('OAS not found'));
  });

  it('fails when YAML parsing throws an Error', () => {
    expect.hasAssertions();
    const logger = makeLogger();
    const code = generateBackendTemplateSeed({
      root: '/r',
      exists: () => true,
      readFile: () => 'x',
      parseYaml: () => { throw new Error('bad yaml'); },
      buildDomainsFromOas: jest.fn(),
      applyAutoLayout: jest.fn(),
      logger
    });
    expect(code).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('bad yaml'));
  });

  it('fails when YAML parsing throws a non-Error', () => {
    expect.hasAssertions();
    const logger = makeLogger();
    const code = generateBackendTemplateSeed({
      root: '/r',
      exists: () => true,
      readFile: () => 'x',
      // eslint-disable-next-line no-throw-literal
      parseYaml: () => { throw 'boom'; },
      buildDomainsFromOas: jest.fn(),
      applyAutoLayout: jest.fn(),
      logger
    });
    expect(code).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });

  it('fails on module/OAS domain mismatch', () => {
    expect.hasAssertions();
    const root = makeRoot(['Users', 'Billing']);
    try {
      const logger = makeLogger();
      const build = jest.fn();
      const code = generateBackendTemplateSeed({
        root,
        exists: () => true,
        readFile: () => 'x',
        parseYaml: oas,
        buildDomainsFromOas: build,
        applyAutoLayout: jest.fn(),
        logger
      });
      expect(code).toBe(1);
      expect(build).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Billing'));
    } finally {
      cleanup(root);
    }
  });

  it('fails when buildDomainsFromOas reports a reason', () => {
    expect.hasAssertions();
    const root = makeRoot();
    try {
      const logger = makeLogger();
      const code = generateBackendTemplateSeed({
        root,
        exists: () => true,
        readFile: () => 'x',
        parseYaml: oas,
        buildDomainsFromOas: () => ({ ok: false, reason: 'no-entities' }),
        applyAutoLayout: jest.fn(),
        logger
      });
      expect(code).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('no-entities'));
    } finally {
      cleanup(root);
    }
  });

  it('fails with unknown reason when the mapper returns nothing', () => {
    expect.hasAssertions();
    const root = makeRoot();
    try {
      const logger = makeLogger();
      const code = generateBackendTemplateSeed({
        root,
        exists: () => true,
        readFile: () => 'x',
        parseYaml: oas,
        buildDomainsFromOas: () => undefined,
        applyAutoLayout: jest.fn(),
        logger
      });
      expect(code).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    } finally {
      cleanup(root);
    }
  });

  it('writes json, meta, and embed with injected fs and mappers', () => {
    expect.hasAssertions();
    const root = makeRoot();
    try {
      const logger = makeLogger();
      const writes: Record<string, string> = {};
      const applyAutoLayout = jest.fn();
      const build = jest.fn((parsed: any) => {
        // Stamping must happen before the mapper runs.
        expect(parsed.components.schemas.User['x-domain']).toBe('Users');
        return {
          ok: true,
          domains: [{ id: 'rand-1', name: 'Users', entities: [{ id: 'rand-2', name: 'User' }] }],
          relationships: [{
            id: 'rand-3', name: 'Owns', fromEntityId: 'rand-2', toEntityId: 'rand-2'
          }],
          architecture: { services: [{ domains: ['rand-1'] }] }
        };
      });
      const code = generateBackendTemplateSeed({
        root,
        exists: () => true,
        readFile: () => 'x',
        parseYaml: oas,
        buildDomainsFromOas: build,
        applyAutoLayout,
        writeFile: (target: string, contents: string) => { writes[target] = contents; },
        now: '2026-01-01T00:00:00.000Z',
        logger
      });
      expect(code).toBe(0);
      expect(applyAutoLayout).toHaveBeenCalledTimes(1);
      const json = JSON.parse(writes[path.join(root, OUT_JSON_REL)]);
      expect(json.domains[0].id).toBe('backend-domain-users');
      expect(json.relationships[0].fromEntityId).toBe('backend-entity-users-user');
      expect(json.architecture.services[0].domains).toStrictEqual(['backend-domain-users']);
      const meta = JSON.parse(writes[path.join(root, OUT_META_REL)]);
      expect(meta).toStrictEqual({
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: 'spec/1.0.0.yml',
        schemaCount: 1,
        domainCount: 1,
        relationshipCount: 1,
        backendModules: ['Users']
      });
      expect(writes[path.join(root, OUT_EMBED_REL)]).toContain('buildBackendTemplateSeedPayload');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('1 domains, 1 relationships, 1 schemas'));
    } finally {
      cleanup(root);
    }
  });

  it('handles an OAS without schemas or modules', () => {
    expect.hasAssertions();
    const root = makeRoot([]);
    try {
      const logger = makeLogger();
      const writes: string[] = [];
      const code = generateBackendTemplateSeed({
        root,
        exists: () => true,
        readFile: () => '',
        parseYaml: () => null,
        buildDomainsFromOas: () => ({ ok: true, domains: [], relationships: [] }),
        applyAutoLayout: jest.fn(),
        writeFile: (target: string) => writes.push(target),
        logger
      });
      expect(code).toBe(0);
      expect(writes).toHaveLength(3);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('0 schemas'));
    } finally {
      cleanup(root);
    }
  });

  it('defaults options and root to process.cwd()', () => {
    expect.hasAssertions();
    const root = makeRoot();
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(root);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      fs.mkdirSync(path.join(root, 'spec'), { recursive: true });
      fs.copyFileSync(path.join(repoRoot, 'spec', '1.0.0.yml'), path.join(root, 'spec', '1.0.0.yml'));
      expect(generateBackendTemplateSeed()).toBe(0);
      expect(fs.existsSync(path.join(root, OUT_META_REL))).toBe(true);
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      cwdSpy.mockRestore();
      logSpy.mockRestore();
      cleanup(root);
    }
  });

  it('uses default fs readers against a real temp tree', () => {
    expect.hasAssertions();
    const root = makeRoot();
    try {
      fs.mkdirSync(path.join(root, 'spec'), { recursive: true });
      fs.writeFileSync(path.join(root, 'spec', '1.0.0.yml'), 'components:\n  schemas: {}\n');
      const logger = makeLogger();
      const code = generateBackendTemplateSeed({
        root,
        logger,
        buildDomainsFromOas: () => ({ ok: true, domains: [], relationships: [] }),
        applyAutoLayout: jest.fn()
      });
      // Users module has no matching OAS domain, proving real readFile/parse ran.
      expect(code).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Users'));
    } finally {
      cleanup(root);
    }
  });
});
