/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const {
  assembleWorkspace,
  buildRootPackageJson,
  buildGitignore,
  buildDockerCompose,
  buildReadme,
  buildProjectJson,
  buildManifestJson,
  listGeneratedFiles,
  sha256File,
  resolvePrimaryDb,
  needsRealtimeRedis
} = require('../dist/generators');

const { resolveSources } = require('../dist/sources');
const { main } = require('../dist/cli');

const fixturesDir = path.join(__dirname, '..', 'fixtures');
const packageRoot = path.join(__dirname, '..');

function fixture(...parts: string[]): string {
  return path.join(fixturesDir, ...parts);
}

function scratch(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cli-init-ws-${label}-`));
}

describe('workspace assembly — helpers (JUM-849)', () => {
  it('builds a Bun workspace root package.json with fan-out scripts', () => {
    expect.hasAssertions();
    const pkg = buildRootPackageJson('My App');
    expect(pkg).toStrictEqual({
      name: 'my-app',
      version: '0.0.0',
      private: true,
      description: 'Generated Jumentix workspace (my-app)',
      packageManager: 'bun@1.3.13',
      workspaces: ['apps/*'],
      scripts: {
        dev: 'bun run --filter \'*\' dev',
        test: 'bun run --filter \'*\' test',
        lint: 'bun run --filter \'*\' lint',
        build: 'bun run --filter \'*\' build'
      }
    });
  });

  it('resolves primary db from core service and realtime redis need', async () => {
    expect.hasAssertions();
    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'websocket',
      db: 'postgres',
      mode: 'monolith'
    });
    expect(resolvePrimaryDb(plan)).toBe('postgres');
    expect(needsRealtimeRedis(plan)).toBe(true);
    expect(buildGitignore()).toContain('node_modules/');
  });

  it('builds docker-compose with postgres and redis when realtime is on', () => {
    expect.hasAssertions();
    const compose = buildDockerCompose('postgres', true, packageRoot);
    expect(compose).toContain('postgresql:');
    expect(compose).toContain('redis-server:');
    expect(compose).toContain('5432:5432');
  });

  it('builds an empty services compose for sqlite without redis', () => {
    expect.hasAssertions();
    const compose = buildDockerCompose('sqlite', false, packageRoot);
    expect(compose).toContain('services: {}');
    expect(compose).not.toContain('postgresql:');
  });
});

describe('workspace assembly — README and project.json (JUM-849)', () => {
  it('documents ports and seeded accounts in README', async () => {
    expect.hasAssertions();
    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      db: 'sqlite',
      mode: 'hybrid',
      frontend: true
    });
    const readme = buildReadme({
      projectName: 'demo',
      plan,
      db: 'sqlite',
      includeRedis: false,
      hasFrontend: true,
      hasBackend: true
    });
    expect(readme).toContain('http://localhost:3000');
    expect(readme).toContain('http://localhost:5173');
    expect(readme).toContain('admin@xpertminds.dev');
    expect(readme).toContain('admin@123456');
  });

  it('builds project.json with cli version, template commit, mode, and plan', () => {
    expect.hasAssertions();
    const plan = {
      mode: 'monolith',
      services: [],
      domains: [],
      contracts: { oasPerService: {} }
    };
    const project = buildProjectJson({
      cliVersion: '1.2.3',
      templateCommit: 'abc123',
      templateSchemaVersion: 1,
      plan,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    expect(project.cliVersion).toBe('1.2.3');
    expect(project.mode).toBe('monolith');
    expect((project.template as { commit: string }).commit).toBe('abc123');
    expect(project.plan).toStrictEqual(plan);
  });
});

describe('workspace assembly — manifest hashing (JUM-849)', () => {
  it('lists generated files and matches sha256 digests', () => {
    expect.hasAssertions();
    const dir = scratch('manifest');
    try {
      fs.mkdirSync(path.join(dir, 'apps', 'core'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"demo"}\n');
      fs.writeFileSync(path.join(dir, 'apps', 'core', 'ok.txt'), 'hello\n');
      fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node_modules', 'skip.txt'), 'nope\n');

      const listed = listGeneratedFiles(dir);
      expect(listed).toStrictEqual(['apps/core/ok.txt', 'package.json']);

      const digest = crypto.createHash('sha256').update('hello\n').digest('hex');
      expect(sha256File(path.join(dir, 'apps', 'core', 'ok.txt'))).toBe(digest);

      const manifest = buildManifestJson(dir);
      expect(manifest.files['apps/core/ok.txt']).toStrictEqual({ sha256: digest });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('workspace assembly — assembleWorkspace (JUM-849)', () => {
  it('writes root files, project.json, init config, and removes service-profile', async () => {
    expect.hasAssertions();
    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      realtime: 'none',
      db: 'postgres',
      mode: 'monolith'
    });
    const out = scratch('assemble');
    try {
      fs.mkdirSync(path.join(out, 'apps', 'core'), { recursive: true });
      fs.writeFileSync(
        path.join(out, 'apps', 'core', 'package.json'),
        '{"name":"@demo/core"}\n'
      );
      fs.mkdirSync(path.join(out, '.jumentix'), { recursive: true });
      fs.writeFileSync(
        path.join(out, '.jumentix', 'service-profile.json'),
        '{"retired":true}\n'
      );

      const result = await assembleWorkspace({
        outputDir: out,
        projectName: 'demo',
        plan,
        answers: {
          mode: 'monolith',
          preset: 'users',
          http: 'express',
          db: 'postgres',
          projectName: 'demo',
          nonInteractive: true
        },
        packageRoot,
        now: new Date('2026-09-20T12:00:00.000Z')
      });

      expect(fs.existsSync(result.rootPackageJson)).toBe(true);
      expect(fs.existsSync(result.dockerCompose)).toBe(true);
      expect(fs.existsSync(result.projectJson)).toBe(true);
      expect(fs.existsSync(path.join(out, '.jumentix', 'service-profile.json'))).toBe(false);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('runs bun install via execute and records bun.lock', async () => {
    expect.hasAssertions();
    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      db: 'sqlite',
      mode: 'monolith'
    });
    const out = scratch('install');
    try {
      fs.mkdirSync(path.join(out, 'apps', 'core'), { recursive: true });
      fs.writeFileSync(path.join(out, 'apps', 'core', 'package.json'), '{"name":"@x/core"}\n');

      const calls: Array<{ cmd: string; args: string[] }> = [];
      const result = await assembleWorkspace({
        outputDir: out,
        projectName: 'demo',
        plan,
        answers: {
          mode: 'monolith',
          preset: 'users',
          projectName: 'demo',
          install: true
        },
        install: true,
        packageRoot,
        execute: (_cmd: string, _args: string[], cwd: string) => {
          calls.push({ cmd: 'bun', args: ['install'] });
          fs.writeFileSync(path.join(cwd, 'bun.lock'), '# fake lock\n');
        }
      });

      expect(calls).toStrictEqual([{ cmd: 'bun', args: ['install'] }]);
      expect(result.installed).toBe(true);
      expect(result.bunLock).toBe(path.join(out, 'bun.lock'));
      expect(fs.existsSync(path.join(out, '.jumentix', 'manifest.json'))).toBe(true);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it('git init + first commit includes the manifest', async () => {
    expect.hasAssertions();
    const plan = await resolveSources({
      preset: 'users',
      presetPath: fixture('users-oas.yml'),
      http: 'express',
      db: 'sqlite',
      mode: 'monolith'
    });
    const out = scratch('git');
    try {
      fs.mkdirSync(path.join(out, 'apps', 'core'), { recursive: true });
      fs.writeFileSync(path.join(out, 'apps', 'core', 'package.json'), '{"name":"@x/core"}\n');

      const result = await assembleWorkspace({
        outputDir: out,
        projectName: 'demo',
        plan,
        answers: {
          mode: 'monolith',
          preset: 'users',
          projectName: 'demo',
          git: true
        },
        git: true,
        packageRoot
      });

      expect(result.gitInitialized).toBe(true);
      expect(fs.existsSync(path.join(out, '.git'))).toBe(true);
      const { spawnSync } = require('node:child_process');
      const show = spawnSync(
        'git',
        ['-C', out, 'ls-tree', '-r', '--name-only', 'HEAD'],
        { encoding: 'utf8' }
      );
      expect(show.status).toBe(0);
      expect(show.stdout).toContain('.jumentix/manifest.json');
      expect(show.stdout).toContain('package.json');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

describe('workspace assembly — init CLI wiring (JUM-849)', () => {
  it('init writes workspace root and .jumentix manifests', async () => {
    expect.hasAssertions();
    const out = scratch('cli');
    const project = path.join(out, 'my-app');
    try {
      const code = await main(
        [
          'init',
          '--non-interactive',
          '--preset=users',
          '--mode=hybrid',
          '--frontend',
          '--http=express',
          '--db=sqlite',
          `--project-name=${project}`
        ],
        () => undefined
      );
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(project, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(project, '.jumentix', 'project.json'))).toBe(true);
      expect(fs.existsSync(path.join(project, '.jumentix', 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(project, '.jumentix', 'service-profile.json'))).toBe(false);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
