import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { InitConfig } from '../config';
import { writeInitConfig } from '../config';
import { runCommand } from '../legacy/bootstrap';
import type {
  DbChoice,
  GenerationPlan,
  RealtimeInterface
} from '../sources/types';
import { sanitizePackageScope } from './paths';

const MANIFEST_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  '.nyc_output',
  'dist',
  '.build'
]);

const DB_COMPOSE_SOURCE: Partial<Record<DbChoice, string>> = {
  postgres: 'docker-compose-postgresql.yml',
  mysql: 'docker-compose-mysql.yml',
  mongo: 'docker-compose-mongodb.yml'
};

const DB_PORTS: Partial<Record<DbChoice, { service: string; host: number; container: number }>> = {
  postgres: { service: 'PostgreSQL', host: 5432, container: 5432 },
  mysql: { service: 'MySQL', host: 3306, container: 3306 },
  mongo: { service: 'MongoDB', host: 27027, container: 27017 }
};

export type WorkspaceAnswers = InitConfig & {
  projectName: string;
  mode: NonNullable<InitConfig['mode']>;
};

export type AssembleWorkspaceOptions = {
  outputDir: string;
  projectName: string;
  plan: GenerationPlan;
  answers: WorkspaceAnswers;
  /** When true, run `bun install` in the workspace root. */
  install?: boolean;
  /** When true, `git init` + first commit including the manifest. */
  git?: boolean;
  /** Override CLI package root (tests). */
  packageRoot?: string;
  /** Override for subprocesses (`bun install`, `git`). */
  execute?: typeof runCommand;
  /** Fixed timestamps for deterministic tests. */
  now?: Date;
  log?: (message?: string) => void;
};

export type AssembleWorkspaceResult = {
  rootPackageJson: string;
  gitignore: string;
  dockerCompose: string;
  readme: string;
  projectJson: string;
  manifestJson: string;
  initConfig: string;
  bunLock: string | null;
  gitInitialized: boolean;
  installed: boolean;
  fileCount: number;
};

type TemplatesManifest = {
  sourceCommit?: string;
  schemaVersion?: number;
};

function readCliVersion(packageRoot: string): string {
  try {
    const raw = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version && parsed.version !== '0.0.0' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readTemplatesManifest(packageRoot: string): TemplatesManifest {
  const manifestPath = path.join(packageRoot, 'templates.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as TemplatesManifest;
  } catch {
    return {};
  }
}

/**
 * Resolve the primary database choice from the generation plan
 * (core service wins; otherwise first service; frontend-only → sqlite).
 */
export function resolvePrimaryDb(plan: GenerationPlan): DbChoice {
  const core = plan.services.find((service) => service.kind === 'core');
  if (core) return core.db;
  if (plan.services[0]) return plan.services[0].db;
  return 'sqlite';
}

/**
 * True when any service enables a realtime interface (needs Redis).
 */
export function needsRealtimeRedis(plan: GenerationPlan): boolean {
  return plan.services.some(
    (service) => (service.interfaces.realtime as RealtimeInterface) !== 'none'
  );
}

/**
 * Conservative generated-project .gitignore.
 */
export function buildGitignore(): string {
  return [
    'node_modules/',
    'dist/',
    '.build/',
    'coverage/',
    '.nyc_output/',
    '*.log',
    '.DS_Store',
    '.env',
    '.env.local',
    '.env.*.local',
    '*.sqlite',
    '*.sqlite3',
    '.turbo/',
    ''
  ].join('\n');
}

function extractComposeBlock(yaml: string, key: string): string {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) return '';
  const collected: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[a-zA-Z]/.test(line) && !line.startsWith(' ')) break;
    collected.push(line);
  }
  return collected.join('\n').replace(/\s+$/, '');
}

function mergeComposeSections(blocks: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      const key = line.trimEnd();
      if (key.length > 0 && !seen.has(key)) {
        seen.add(key);
        out.push(line);
      }
    }
  }
  return out.join('\n');
}

/**
 * Root Bun workspace package.json with fan-out scripts.
 */
export function buildRootPackageJson(projectName: string): Record<string, unknown> {
  const name = sanitizePackageScope(projectName);
  return {
    name,
    version: '0.0.0',
    private: true,
    description: `Generated Jumentix workspace (${name})`,
    packageManager: 'bun@1.3.13',
    workspaces: ['apps/*'],
    scripts: {
      dev: 'bun run --filter \'*\' dev',
      test: 'bun run --filter \'*\' test',
      lint: 'bun run --filter \'*\' lint',
      build: 'bun run --filter \'*\' build'
    }
  };
}

/**
 * Build a root docker-compose.yml for the chosen db (+ redis when realtime).
 */
export function buildDockerCompose(
  db: DbChoice,
  includeRedis: boolean,
  packageRoot: string
): string {
  const services: string[] = [];
  const volumes: string[] = [];
  const networks: string[] = [];

  const templateRoot = path.join(packageRoot, 'templates', 'backend');
  const dbFile = DB_COMPOSE_SOURCE[db];
  if (dbFile) {
    const sourcePath = path.join(templateRoot, dbFile);
    if (fs.existsSync(sourcePath)) {
      const body = fs.readFileSync(sourcePath, 'utf8');
      services.push(extractComposeBlock(body, 'services'));
      const vol = extractComposeBlock(body, 'volumes');
      if (vol) volumes.push(vol);
      const net = extractComposeBlock(body, 'networks');
      if (net) networks.push(net);
    }
  }

  if (includeRedis) {
    const redisPath = path.join(templateRoot, 'docker-compose-redis.yml');
    if (fs.existsSync(redisPath)) {
      const body = fs.readFileSync(redisPath, 'utf8');
      services.push(extractComposeBlock(body, 'services'));
      const vol = extractComposeBlock(body, 'volumes');
      if (vol) volumes.push(vol);
      const net = extractComposeBlock(body, 'networks');
      if (net) networks.push(net);
    }
  }

  if (services.length === 0) {
    return [
      '# No external database or cache containers required for this generation',
      `# (db=${db}, realtime redis=${includeRedis ? 'yes' : 'no'}).`,
      'services: {}',
      ''
    ].join('\n');
  }

  const parts = [
    '# Generated by @jumentix/cli-init — start with: docker compose up -d',
    'services:',
    mergeComposeSections(services)
  ];
  if (volumes.length > 0) {
    parts.push('volumes:', mergeComposeSections(volumes));
  }
  if (networks.length > 0) {
    parts.push('networks:', mergeComposeSections(networks));
  }
  parts.push('');
  return `${parts.join('\n')}\n`;
}

/**
 * Generated README: how to run, ports, seeded accounts.
 */
export function buildReadme(input: {
  projectName: string;
  plan: GenerationPlan;
  db: DbChoice;
  includeRedis: boolean;
  hasFrontend: boolean;
  hasBackend: boolean;
}): string {
  const name = sanitizePackageScope(input.projectName);
  const ports: string[] = [];
  if (input.hasBackend) {
    ports.push('- API (HTTP): `http://localhost:3000`');
  }
  if (input.hasFrontend) {
    ports.push('- Frontend (Vite): `http://localhost:5173`');
  }
  const dbPort = DB_PORTS[input.db];
  if (dbPort) {
    ports.push(`- ${dbPort.service}: \`localhost:${dbPort.host}\``);
  }
  if (input.includeRedis) {
    ports.push('- Redis: `localhost:6379`');
  }
  if (ports.length === 0) {
    ports.push('- (no networked services for this generation)');
  }

  const infraSteps: string[] = [];
  if (dbPort || input.includeRedis) {
    infraSteps.push('2. Start infrastructure: `docker compose up -d`');
  }
  const installStep = infraSteps.length > 0 ? 3 : 2;
  const devStep = installStep + 1;

  const modeLine = input.includeRedis
    ? `Mode: \`${input.plan.mode}\` · Database: \`${input.db}\` · Realtime Redis: yes`
    : `Mode: \`${input.plan.mode}\` · Database: \`${input.db}\``;

  return [
    `# ${name}`,
    '',
    'Generated by `@jumentix/cli-init` (Requirement 037 v2).',
    '',
    modeLine,
    '',
    '## Quick start',
    '',
    '1. Install dependencies (Bun only — do not use npm):',
    '',
    '```bash',
    'bun install',
    '```',
    '',
    ...(infraSteps.length > 0
      ? [
        ...infraSteps,
        '',
        `${installStep}. Run the workspace:`,
        ''
      ]
      : [
        `${installStep}. Run the workspace:`,
        ''
      ]),
    '```bash',
    'bun run dev',
    '```',
    '',
    `${devStep}. Other fan-out scripts: \`bun run test\`, \`bun run lint\`, \`bun run build\`.`,
    '',
    '## Ports',
    '',
    ...ports,
    '',
    '## Seeded accounts',
    '',
    'When the Users domain is present (default preset), sign in with:',
    '',
    '| Username | Password | Role |',
    '| --- | --- | --- |',
    '| `eduardo@xpertminds.dev` | `eduardo@123456` | superadmin |',
    '| `admin@xpertminds.dev` | `admin@123456` | admin |',
    '| `user@xpertminds.dev` | `user@123456` | user |',
    '',
    '## Metadata',
    '',
    '- `.jumentix/project.json` — generation plan snapshot',
    '- `.jumentix/manifest.json` — sha256 of every generated file',
    '- `jumentix.init.json` — answers for `--config` round-trips',
    '',
    '`.jumentix/service-profile.json` is not part of this contract.',
    ''
  ].join('\n');
}

/**
 * Build `.jumentix/project.json` payload.
 */
export function buildProjectJson(input: {
  cliVersion: string;
  templateCommit: string;
  templateSchemaVersion: number | undefined;
  plan: GenerationPlan;
  createdAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    cliVersion: input.cliVersion,
    template: {
      version: input.templateSchemaVersion ?? 1,
      commit: input.templateCommit || 'unknown'
    },
    mode: input.plan.mode,
    plan: input.plan,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
}

/**
 * Walk the generated tree and return posix-relative paths (sorted).
 */
export function listGeneratedFiles(rootDir: string): string[] {
  const files: string[] = [];
  const walk = (dir: string, rel = ''): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!MANIFEST_SKIP_DIRS.has(entry.name)) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        const absolute = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(absolute, relPath);
        } else if (entry.isFile()) {
          files.push(relPath.replace(/\\/g, '/'));
        }
      }
    }
  };
  walk(rootDir);
  return files.sort();
}

/**
 * sha256 hex digest of a file's bytes.
 */
export function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Build `.jumentix/manifest.json` from the current workspace tree.
 */
export function buildManifestJson(rootDir: string): {
  schemaVersion: number;
  generatedAt: string;
  files: Record<string, { sha256: string }>;
} {
  const files: Record<string, { sha256: string }> = {};
  for (const rel of listGeneratedFiles(rootDir)) {
    // Skip the manifest itself while hashing (written after).
    if (rel !== '.jumentix/manifest.json') {
      files[rel] = { sha256: sha256File(path.join(rootDir, ...rel.split('/'))) };
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    files
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function removeRetiredServiceProfile(outputDir: string): void {
  const legacy = path.join(outputDir, '.jumentix', 'service-profile.json');
  if (fs.existsSync(legacy)) {
    fs.unlinkSync(legacy);
  }
}

function initGitRepo(
  outputDir: string,
  execute: typeof runCommand
): void {
  execute('git', ['init', '-b', 'main'], outputDir);
  execute('git', ['add', '-A'], outputDir);
  execute(
    'git',
    [
      '-c',
      'user.name=jumentix-init',
      '-c',
      'user.email=jumentix-init@local',
      'commit',
      '-m',
      'chore: initial Jumentix workspace'
    ],
    outputDir
  );
}

/**
 * Assemble the generated workspace root after backend/frontend generation.
 */
export async function assembleWorkspace(
  options: AssembleWorkspaceOptions
): Promise<AssembleWorkspaceResult> {
  const {
    outputDir,
    projectName,
    plan,
    answers,
    install = false,
    git = false,
    log = () => undefined,
    now = new Date()
  } = options;
  const execute = options.execute ?? runCommand;

  const packageRoot = options.packageRoot || path.resolve(__dirname, '..', '..');
  const cliVersion = readCliVersion(packageRoot);
  const templates = readTemplatesManifest(packageRoot);
  const db = resolvePrimaryDb(plan);
  const includeRedis = needsRealtimeRedis(plan);
  const hasBackend = plan.mode !== 'frontend' && plan.services.length > 0;
  const hasFrontend = Boolean(
    plan.frontend || plan.mode === 'hybrid' || plan.mode === 'frontend'
  );
  const timestamp = now.toISOString();

  fs.mkdirSync(outputDir, { recursive: true });
  removeRetiredServiceProfile(outputDir);

  const rootPkgPath = path.join(outputDir, 'package.json');
  writeJson(rootPkgPath, buildRootPackageJson(projectName));

  const gitignorePath = path.join(outputDir, '.gitignore');
  fs.writeFileSync(gitignorePath, buildGitignore(), 'utf8');

  const composePath = path.join(outputDir, 'docker-compose.yml');
  fs.writeFileSync(
    composePath,
    buildDockerCompose(db, includeRedis, packageRoot),
    'utf8'
  );

  const readmePath = path.join(outputDir, 'README.md');
  fs.writeFileSync(
    readmePath,
    buildReadme({
      projectName,
      plan,
      db,
      includeRedis,
      hasFrontend,
      hasBackend
    }),
    'utf8'
  );

  const initConfigPath = writeInitConfig(outputDir, {
    ...answers,
    projectName: answers.projectName || projectName,
    mode: answers.mode || plan.mode,
    install,
    git
  });

  const jumentixDir = path.join(outputDir, '.jumentix');
  fs.mkdirSync(jumentixDir, { recursive: true });
  const projectJsonPath = path.join(jumentixDir, 'project.json');
  writeJson(
    projectJsonPath,
    buildProjectJson({
      cliVersion,
      templateCommit: templates.sourceCommit || '',
      templateSchemaVersion: templates.schemaVersion,
      plan,
      createdAt: timestamp,
      updatedAt: timestamp
    })
  );

  let installed = false;
  let bunLock: string | null = null;
  if (install) {
    log('Installing dependencies with bun…');
    execute('bun', ['install'], outputDir);
    installed = true;
    const lockPath = path.join(outputDir, 'bun.lock');
    if (fs.existsSync(lockPath)) {
      bunLock = lockPath;
    }
  }

  // Manifest after install so bun.lock (when present) is hashed.
  const manifest = buildManifestJson(outputDir);
  manifest.generatedAt = timestamp;
  const manifestPath = path.join(jumentixDir, 'manifest.json');
  writeJson(manifestPath, manifest);

  // Re-hash after writing manifest so the on-disk file is listed? Spec says
  // "sha256 of every generated file" — include manifest by hashing peers only
  // (manifest cannot include its own final hash). Leave as-is.

  let gitInitialized = false;
  if (git) {
    log('Initializing git repository…');
    initGitRepo(outputDir, execute);
    gitInitialized = true;
  }

  const fileCount = Object.keys(manifest.files).length;
  log(
    `Workspace assembly wrote root package.json, docker-compose.yml, README.md, .jumentix/project.json, and manifest (${fileCount} files).`
  );

  return {
    rootPackageJson: rootPkgPath,
    gitignore: gitignorePath,
    dockerCompose: composePath,
    readme: readmePath,
    projectJson: projectJsonPath,
    manifestJson: manifestPath,
    initConfig: initConfigPath,
    bunLock,
    gitInitialized,
    installed,
    fileCount
  };
}
