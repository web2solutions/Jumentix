/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const { main } = require('../dist/cli');
const { runAdd, printAddHelp } = require('../dist/commands/add');
const { parseArgv } = require('../dist/args');

const fixturesDir = path.join(__dirname, '..', 'fixtures');

function fixture(...parts: string[]): string {
  return path.join(fixturesDir, ...parts);
}

function scratch(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cli-init-add-${label}-`));
}

async function initProject(projectDir: string, extra: string[] = []): Promise<number> {
  return main(
    [
      'init',
      '--non-interactive',
      '--preset=users',
      '--mode=monolith',
      '--http=express',
      '--db=sqlite',
      `--project-name=${projectDir}`,
      ...extra
    ],
    () => undefined
  );
}

describe('add command — help and metadata gate (JUM-850)', () => {
  it('printAddHelp documents domain service and frontend', () => {
    expect.hasAssertions();
    const lines: string[] = [];
    printAddHelp((message = '') => {
      lines.push(message);
    });
    const text = lines.join('\n');
    expect(text).toContain('add domain');
    expect(text).toContain('add service');
    expect(text).toContain('add frontend');
  });

  it('refuses when .jumentix/project.json is missing', async () => {
    expect.hasAssertions();
    const dir = scratch('missing-meta');
    try {
      const messages: string[] = [];
      const code = await runAdd({
        subcommand: 'domain',
        positional: ['domain', 'Catalog'],
        help: false,
        workingDirectory: dir,
        log: (message = '') => {
          messages.push(message);
        }
      });
      expect(code).toBe(1);
      expect(messages.join('\n')).toContain('.jumentix/project.json');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses --domains --force and --service for add', () => {
    expect.hasAssertions();
    const parsed = parseArgv([
      'add',
      'service',
      'billing',
      '--domains=Orders,Catalog',
      '--force',
      '--service=core'
    ]);
    expect(parsed.subcommand).toBe('service');
    expect(parsed.init.domains).toBe('Orders,Catalog');
    expect(parsed.init.force).toBe(true);
    expect(parsed.init.service).toBe('core');
  });
});

describe('add domain (JUM-850)', () => {
  it('injects a stub domain into core and updates manifests', async () => {
    expect.hasAssertions();
    const out = scratch('domain');
    const project = path.join(out, 'app');
    try {
      await expect(initProject(project)).resolves.toBe(0);

      const code = await runAdd({
        subcommand: 'domain',
        positional: ['domain', 'Catalog'],
        help: false,
        workingDirectory: project,
        log: () => undefined
      });
      expect(code).toBe(0);

      const projectJson = JSON.parse(
        fs.readFileSync(path.join(project, '.jumentix', 'project.json'), 'utf8')
      ) as { plan: { domains: Array<{ name?: string }> } };
      expect(
        projectJson.plan.domains.some((domain) => domain.name === 'Catalog')
      ).toBe(true);
      expect(
        fs.existsSync(path.join(project, '.jumentix', 'manifest.json'))
      ).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('rejects adding a domain that already exists via --from', async () => {
    expect.hasAssertions();
    const out = scratch('domain-from');
    const project = path.join(out, 'app');
    try {
      await expect(initProject(project)).resolves.toBe(0);
      const code = await runAdd({
        subcommand: 'domain',
        positional: ['domain', 'Users'],
        help: false,
        flags: { from: fixture('designer-export.json') },
        workingDirectory: project,
        log: () => undefined
      });
      expect(code).toBe(1);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('add frontend (JUM-850)', () => {
  it('generates apps/frontend on a backend-only project and sets hybrid', async () => {
    expect.hasAssertions();
    const out = scratch('frontend');
    const project = path.join(out, 'app');
    try {
      await expect(initProject(project)).resolves.toBe(0);

      const code = await runAdd({
        subcommand: 'frontend',
        positional: ['frontend'],
        help: false,
        workingDirectory: project,
        log: () => undefined
      });
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(project, 'apps', 'frontend', 'package.json'))).toBe(true);

      const projectJson = JSON.parse(
        fs.readFileSync(path.join(project, '.jumentix', 'project.json'), 'utf8')
      ) as { mode: string };
      expect(projectJson.mode).toBe('hybrid');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('add service (JUM-850)', () => {
  it('creates a new domain service under services mode', async () => {
    expect.hasAssertions();
    const out = scratch('service');
    const project = path.join(out, 'app');
    try {
      const initCode = await main(
        [
          'init',
          '--non-interactive',
          '--preset=users',
          '--mode=services',
          '--http=express',
          '--db=sqlite',
          `--project-name=${project}`
        ],
        () => undefined
      );
      expect(initCode).toBe(0);

      await expect(
        runAdd({
          subcommand: 'domain',
          positional: ['domain', 'Orders'],
          help: false,
          workingDirectory: project,
          log: () => undefined
        })
      ).resolves.toBe(0);

      const code = await runAdd({
        subcommand: 'service',
        positional: ['service', 'orders'],
        help: false,
        flags: { domains: 'Orders' },
        workingDirectory: project,
        log: () => undefined
      });
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(project, 'apps', 'orders', 'package.json'))).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('add --force / drift (JUM-850)', () => {
  it('refuses when a manifested file was edited unless --force', async () => {
    expect.hasAssertions();
    const out = scratch('drift');
    const project = path.join(out, 'app');
    try {
      await expect(initProject(project)).resolves.toBe(0);
      const readme = path.join(project, 'README.md');
      fs.appendFileSync(readme, '\n# edited\n', 'utf8');

      const blocked = await runAdd({
        subcommand: 'domain',
        positional: ['domain', 'Inventory'],
        help: false,
        workingDirectory: project,
        log: () => undefined
      });
      expect(blocked).toBe(1);

      const forced = await runAdd({
        subcommand: 'domain',
        positional: ['domain', 'Inventory'],
        help: false,
        flags: { force: true },
        workingDirectory: project,
        log: () => undefined
      });
      expect(forced).toBe(0);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
