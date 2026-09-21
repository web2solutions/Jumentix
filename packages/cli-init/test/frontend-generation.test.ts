/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const {
  mergeServiceOas,
  oasPathCount,
  resolveEntityOperations,
  searchableFieldsForOperation,
  generateFrontend,
  resolveFrontendTemplateRoot
} = require('../dist/generators');

const { resolveSources } = require('../dist/sources');
const { main } = require('../dist/cli');

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const templateRoot = path.join(__dirname, '..', 'templates', 'frontend');

function fixture(...parts: string[]): string {
  return path.join(fixturesDir, ...parts);
}

describe('frontend generation — OAS helpers (JUM-848)', () => {
  it('merges per-service paths and schemas', () => {
    expect.hasAssertions();
    const merged = mergeServiceOas({
      core: {
        openapi: '3.1.0',
        paths: { '/users': { get: { operationId: 'getAll' } } },
        components: { schemas: { User: { type: 'object' } } }
      },
      billing: {
        paths: { '/invoices': { get: { operationId: 'listInvoices' } } },
        components: { schemas: { Invoice: { type: 'object' } } }
      }
    });
    expect(oasPathCount(merged)).toBe(2);
    expect(Object.keys((merged.components as { schemas: object }).schemas)).toStrictEqual(
      expect.arrayContaining(['User', 'Invoice'])
    );
    expect((merged.paths as Record<string, unknown>)['/users']).toBeDefined();
  });

  it('resolves CRUD operation ids and searchable fields from OAS', () => {
    expect.hasAssertions();
    const oas = {
      paths: {
        '/items': {
          get: {
            operationId: 'listItems',
            tags: ['Item'],
            'x-list-capabilities': { searchable: ['name', 'sku'] }
          },
          post: { operationId: 'createItem', tags: ['Item'] }
        },
        '/items/{id}': {
          put: { operationId: 'updateItem', tags: ['Item'] },
          delete: { operationId: 'deleteItem', tags: ['Item'] }
        }
      },
      components: {
        schemas: {
          Item: { type: 'object' },
          RequestCreateItem: { type: 'object' },
          RequestUpdateItem: { type: 'object' }
        }
      }
    };
    const ops = resolveEntityOperations(oas, 'Item');
    expect(ops).toStrictEqual({
      list: 'listItems',
      create: 'createItem',
      update: 'updateItem',
      delete: 'deleteItem'
    });
    expect(searchableFieldsForOperation(oas, 'listItems')).toStrictEqual(['name', 'sku']);
  });
});

describe('frontend generation — generateFrontend (JUM-848)', () => {
  it('copies the frontend seed into apps/frontend', async () => {
    expect.hasAssertions();
    expect(fs.existsSync(templateRoot)).toBe(true);

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite',
      frontend: true,
      offline: true,
      mode: 'hybrid'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-frontend-gen-'));
    try {
      const result = await generateFrontend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      expect(result.packageName).toBe('@demo/frontend');
      expect(fs.existsSync(path.join(result.root, 'package.json'))).toBe(true);
      expect(result.modules.length).toBeGreaterThanOrEqual(1);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('bakes OAS contracts and writes module entity configs', async () => {
    expect.hasAssertions();

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite',
      frontend: true,
      offline: true,
      mode: 'hybrid'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-frontend-oas-'));
    try {
      const result = await generateFrontend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      const oasPath = path.join(result.root, 'src', 'contracts', 'openapi.json');
      const oas = JSON.parse(fs.readFileSync(oasPath, 'utf8'));
      expect(oasPathCount(oas)).toBeGreaterThan(0);
      expect(result.modules[0].moduleId).toBe('users');
      const configSource = fs.readFileSync(
        path.join(result.root, 'src', 'features', 'user', 'userCrudConfig.ts'),
        'utf8'
      );
      expect(configSource).toContain('list: \'getAll\'');
      expect(configSource).toContain('searchFields:');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('writes .env with Core URL and honors --offline', async () => {
    expect.hasAssertions();

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite',
      frontend: true,
      offline: true,
      mode: 'hybrid'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-frontend-env-'));
    try {
      const result = await generateFrontend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      const env = fs.readFileSync(result.envPath, 'utf8');
      expect(env).toContain('VITE_API_BASE_URL=');
      expect(env).toContain('VITE_OFFLINE=1');
      expect(result.offline).toBe(true);
      expect(fs.existsSync(path.join(result.root, 'cypress', 'e2e', 'offline-boot.cy.ts'))).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('disables Cana offline layer when offline=false', async () => {
    expect.hasAssertions();

    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'sqlite',
      frontend: true,
      offline: false,
      mode: 'hybrid'
    });

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-frontend-online-'));
    try {
      const result = await generateFrontend({
        plan,
        outputDir: out,
        projectName: 'demo',
        templateRoot,
        jumentixVersion: '0.0.0'
      });
      const env = fs.readFileSync(result.envPath, 'utf8');
      expect(env).toContain('VITE_OFFLINE=0');
      const mainSource = fs.readFileSync(path.join(result.root, 'src', 'main.ts'), 'utf8');
      expect(mainSource).not.toContain('bootCana');
      expect(fs.existsSync(path.join(result.root, 'cypress', 'e2e', 'offline-boot.cy.ts'))).toBe(false);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('init --mode=hybrid --frontend writes apps/frontend', async () => {
    expect.hasAssertions();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-frontend-cli-'));
    const project = path.join(out, 'my-app');
    try {
      const messages: string[] = [];
      const code = await main(
        [
          'init',
          '--non-interactive',
          '--preset=users',
          '--mode=hybrid',
          '--frontend',
          '--offline',
          '--http=express',
          '--db=sqlite',
          `--project-name=${project}`
        ],
        (message = '') => {
          messages.push(message);
        }
      );
      expect(code).toBe(0);
      expect(messages.join('\n')).toContain('Frontend generation wrote');
      expect(fs.existsSync(path.join(project, 'apps', 'frontend', 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(project, 'apps', 'core', 'package.json'))).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('frontend generation — template root (JUM-848)', () => {
  it('resolveFrontendTemplateRoot points at packaged seed', () => {
    expect.hasAssertions();
    const packageRoot = path.join(__dirname, '..');
    const resolved = resolveFrontendTemplateRoot(packageRoot);
    expect(resolved).toBe(path.join(packageRoot, 'templates', 'frontend'));
    expect(fs.existsSync(resolved)).toBe(true);
  });
});
