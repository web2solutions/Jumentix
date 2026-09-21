/**
 * Generation e2e matrix harness (JUM-854).
 *
 * Default path always exercises at least one non-Docker cell
 * (`monolith/express/sqlite`). Heavy Docker-backed cells run only when
 * `CLI_INIT_E2E_DOCKER=1` and Docker is available; otherwise they skip with a
 * named reason (Requirement 118 — no silent green for Docker work).
 *
 * Optional `CLI_INIT_E2E_INSTALL=1` adds `bun install` after generation when
 * feasible; unpublished `0.0.0` pins often make install non-viable in unit time.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type MatrixCellId =
  | 'monolith-express-sqlite'
  | 'monolith-fastify-postgres'
  | 'services-core-domain'
  | 'hybrid-express-sqlite'
  | 'frontend-only'
  | 'hybrid-offline';

export type CellStatus = 'passed' | 'failed' | 'skipped';

export type MatrixCell = {
  id: MatrixCellId;
  /** Human-readable matrix coordinate. */
  label: string;
  /** Args after `init` (without project path). */
  initArgs: string[];
  /** Paths that must exist after generation (relative to project root). */
  expectApps: string[];
  /** Requires Docker compose / HTTP smoke. */
  needsDocker: boolean;
};

export type CellResult = {
  id: MatrixCellId;
  label: string;
  status: CellStatus;
  runtimeMs: number;
  /** Command that failed (required when status === 'failed'). */
  failedCommand?: string;
  skipReason?: string;
  detail?: string;
};

export type MatrixReport = {
  results: CellResult[];
  totalRuntimeMs: number;
  dockerEnabled: boolean;
  dockerAvailable: boolean;
  installEnabled: boolean;
};

export const GENERATION_MATRIX: readonly MatrixCell[] = Object.freeze([
  {
    id: 'monolith-express-sqlite',
    label: 'monolith/express/sqlite',
    initArgs: [
      '--non-interactive',
      '--preset=users',
      '--mode=monolith',
      '--http=express',
      '--db=sqlite'
    ],
    expectApps: ['apps/core/package.json', 'package.json', '.jumentix/project.json'],
    needsDocker: false
  },
  {
    id: 'monolith-fastify-postgres',
    label: 'monolith/fastify/postgres',
    initArgs: [
      '--non-interactive',
      '--preset=users',
      '--mode=monolith',
      '--http=fastify',
      '--db=postgres'
    ],
    expectApps: ['apps/core/package.json', 'docker-compose.yml', '.jumentix/project.json'],
    needsDocker: true
  },
  {
    id: 'services-core-domain',
    label: 'services/express/sqlite (core+Users domain)',
    initArgs: [
      '--non-interactive',
      '--preset=users',
      '--mode=services',
      '--http=express',
      '--db=sqlite'
    ],
    expectApps: [
      'apps/core/package.json',
      'apps/core/src/modules/Users',
      '.jumentix/project.json'
    ],
    needsDocker: false
  },
  {
    id: 'hybrid-express-sqlite',
    label: 'hybrid/express/sqlite + frontend',
    initArgs: [
      '--non-interactive',
      '--preset=users',
      '--mode=hybrid',
      '--frontend',
      '--http=express',
      '--db=sqlite'
    ],
    expectApps: [
      'apps/core/package.json',
      'apps/frontend/package.json',
      '.jumentix/project.json'
    ],
    needsDocker: false
  },
  {
    id: 'frontend-only',
    label: 'frontend-only',
    initArgs: [
      '--non-interactive',
      '--preset=users',
      '--mode=frontend',
      '--offline'
    ],
    expectApps: ['apps/frontend/package.json', '.jumentix/project.json'],
    needsDocker: false
  },
  {
    id: 'hybrid-offline',
    label: 'hybrid/express/sqlite --offline',
    initArgs: [
      '--non-interactive',
      '--preset=users',
      '--mode=hybrid',
      '--frontend',
      '--offline',
      '--http=express',
      '--db=sqlite'
    ],
    expectApps: [
      'apps/core/package.json',
      'apps/frontend/package.json',
      '.jumentix/project.json'
    ],
    needsDocker: false
  }
]);

const DOCKER_ENV = 'CLI_INIT_E2E_DOCKER';
const INSTALL_ENV = 'CLI_INIT_E2E_INSTALL';

export function isDockerMatrixEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[DOCKER_ENV] === '1';
}

export function isInstallEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[INSTALL_ENV] === '1';
}

export function probeDockerAvailable(): boolean {
  const probe = spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return probe.status === 0;
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(' ');
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): { status: number; stdout: string; stderr: string; commandLine: string } {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    commandLine: formatCommand(command, args)
  };
}

export type RunMatrixOptions = {
  packageRoot: string;
  env?: NodeJS.ProcessEnv;
  /** Override Docker probe (tests). */
  dockerAvailable?: boolean;
  /** Restrict which cells run (default: all). */
  cells?: readonly MatrixCell[];
  /** Keep tmp dirs on failure for debugging. */
  keepOnFailure?: boolean;
  log?: (message: string) => void;
};

function scratchRoot(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cli-init-e2e-${label}-`));
}

function verifyExpectedApps(projectDir: string, expectApps: string[]): string | null {
  for (const rel of expectApps) {
    const absolute = path.join(projectDir, rel);
    if (!fs.existsSync(absolute)) {
      return `missing expected path: ${rel}`;
    }
  }
  return null;
}

function runDockerSmoke(
  projectDir: string
): { ok: boolean; failedCommand?: string; detail?: string } {
  const composeFile = path.join(projectDir, 'docker-compose.yml');
  if (!fs.existsSync(composeFile)) {
    return {
      ok: false,
      failedCommand: `test -f ${composeFile}`,
      detail: 'generated project has no docker-compose.yml'
    };
  }

  const up = runCommand('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], {
    cwd: projectDir
  });
  if (up.status !== 0) {
    runCommand('docker', ['compose', '-f', composeFile, 'down', '--remove-orphans'], {
      cwd: projectDir
    });
    return {
      ok: false,
      failedCommand: up.commandLine,
      detail: (up.stderr || up.stdout || 'compose up failed').trim()
    };
  }

  // Best-effort HTTP smoke against the generated backend default port.
  const smoke = runCommand('curl', ['-fsS', '-o', '/dev/null', '-w', '%{http_code}', 'http://127.0.0.1:3000/'], {
    cwd: projectDir
  });
  runCommand('docker', ['compose', '-f', composeFile, 'down', '--remove-orphans'], {
    cwd: projectDir
  });

  if (smoke.status !== 0) {
    return {
      ok: false,
      failedCommand: smoke.commandLine,
      detail: (smoke.stderr || smoke.stdout || 'HTTP smoke failed').trim()
    };
  }

  return { ok: true, detail: `HTTP ${smoke.stdout.trim() || 'ok'}` };
}

/**
 * Run one matrix cell: CLI init → verify apps → optional install → optional Docker smoke.
 */
export function runMatrixCell(
  cell: MatrixCell,
  options: RunMatrixOptions
): CellResult {
  const env = options.env || process.env;
  const log = options.log || (() => undefined);
  const started = Date.now();

  if (cell.needsDocker) {
    if (!isDockerMatrixEnabled(env)) {
      return {
        id: cell.id,
        label: cell.label,
        status: 'skipped',
        runtimeMs: Date.now() - started,
        skipReason: `${DOCKER_ENV}!=1 (heavy Docker cell gated for default bun test speed)`
      };
    }
    const dockerOk = typeof options.dockerAvailable === 'boolean'
      ? options.dockerAvailable
      : probeDockerAvailable();
    if (!dockerOk) {
      return {
        id: cell.id,
        label: cell.label,
        status: 'skipped',
        runtimeMs: Date.now() - started,
        skipReason: 'docker unavailable (CLI_INIT_E2E_DOCKER=1 set but docker probe failed)'
      };
    }
  }

  const tmp = scratchRoot(cell.id);
  const projectDir = path.join(tmp, 'app');
  const bin = path.join(options.packageRoot, 'bin', 'jumentix.js');
  const initArgs = ['init', ...cell.initArgs, `--project-name=${projectDir}`];
  const initCommand = formatCommand('bun', [bin, ...initArgs]);

  try {
    log(`[matrix] ${cell.label}: ${initCommand}`);
    const init = runCommand('bun', [bin, ...initArgs], {
      cwd: options.packageRoot,
      env
    });
    if (init.status !== 0) {
      return {
        id: cell.id,
        label: cell.label,
        status: 'failed',
        runtimeMs: Date.now() - started,
        failedCommand: init.commandLine,
        detail: (init.stderr || init.stdout || `exit ${init.status}`).trim()
      };
    }

    const missing = verifyExpectedApps(projectDir, cell.expectApps);
    if (missing) {
      return {
        id: cell.id,
        label: cell.label,
        status: 'failed',
        runtimeMs: Date.now() - started,
        failedCommand: `verify ${cell.expectApps.join(', ')}`,
        detail: missing
      };
    }

    if (isInstallEnabled(env)) {
      const install = runCommand('bun', ['install'], { cwd: projectDir, env });
      if (install.status !== 0) {
        return {
          id: cell.id,
          label: cell.label,
          status: 'failed',
          runtimeMs: Date.now() - started,
          failedCommand: install.commandLine,
          detail: (install.stderr || install.stdout || 'bun install failed').trim()
        };
      }
    }

    if (cell.needsDocker) {
      const smoke = runDockerSmoke(projectDir);
      if (!smoke.ok) {
        return {
          id: cell.id,
          label: cell.label,
          status: 'failed',
          runtimeMs: Date.now() - started,
          failedCommand: smoke.failedCommand,
          detail: smoke.detail
        };
      }
      return {
        id: cell.id,
        label: cell.label,
        status: 'passed',
        runtimeMs: Date.now() - started,
        detail: smoke.detail
      };
    }

    return {
      id: cell.id,
      label: cell.label,
      status: 'passed',
      runtimeMs: Date.now() - started,
      detail: `generated ${cell.expectApps.length} expected path(s)`
    };
  } finally {
    if (!options.keepOnFailure) {
      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

export function formatMatrixReport(report: MatrixReport): string {
  const lines = [
    'cli-init generation e2e matrix (JUM-854)',
    `dockerEnabled=${report.dockerEnabled} dockerAvailable=${report.dockerAvailable} `
      + `installEnabled=${report.installEnabled} totalMs=${report.totalRuntimeMs}`,
    ''
  ];
  for (const cell of report.results) {
    const base = `${cell.status.toUpperCase().padEnd(7)} ${cell.label} (${cell.runtimeMs}ms)`;
    if (cell.status === 'failed') {
      lines.push(`${base} failedCommand=${cell.failedCommand || '(unknown)'}`);
      if (cell.detail) lines.push(`         ${cell.detail}`);
    } else if (cell.status === 'skipped') {
      lines.push(`${base} reason=${cell.skipReason || '(none)'}`);
    } else {
      lines.push(cell.detail ? `${base} ${cell.detail}` : base);
    }
  }
  return lines.join('\n');
}

/**
 * Execute the full (or filtered) generation matrix and return a timed report.
 */
export function runGenerationMatrix(options: RunMatrixOptions): MatrixReport {
  const env = options.env || process.env;
  const cells = options.cells || GENERATION_MATRIX;
  const dockerEnabled = isDockerMatrixEnabled(env);
  const dockerAvailable = typeof options.dockerAvailable === 'boolean'
    ? options.dockerAvailable
    : probeDockerAvailable();
  const installEnabled = isInstallEnabled(env);
  const started = Date.now();
  const results: CellResult[] = [];

  for (const cell of cells) {
    results.push(
      runMatrixCell(cell, {
        ...options,
        env,
        dockerAvailable
      })
    );
  }

  return {
    results,
    totalRuntimeMs: Date.now() - started,
    dockerEnabled,
    dockerAvailable,
    installEnabled
  };
}

export function assertMatrixAcceptable(report: MatrixReport): void {
  const required = report.results.find((cell) => cell.id === 'monolith-express-sqlite');
  if (!required || required.status !== 'passed') {
    const failedCommand = required?.failedCommand || 'monolith-express-sqlite';
    throw new Error(
      'Required cell monolith/express/sqlite did not pass '
        + `(failedCommand=${failedCommand}): ${required?.detail || 'missing result'}`
    );
  }

  for (const cell of report.results) {
    if (typeof cell.runtimeMs !== 'number' || cell.runtimeMs < 0) {
      throw new Error(`${cell.label}: missing non-negative runtimeMs`);
    }
    if (cell.status === 'failed' && !cell.failedCommand) {
      throw new Error(`${cell.label}: failed cell must name failedCommand`);
    }
    if (cell.status === 'skipped' && !cell.skipReason) {
      throw new Error(`${cell.label}: skipped cell must name skipReason`);
    }
  }

  const failed = report.results.filter((cell) => cell.status === 'failed');
  if (failed.length > 0) {
    const summary = failed
      .map((cell) => `${cell.label}: failedCommand=${cell.failedCommand}`)
      .join('; ');
    throw new Error(`Generation matrix failures: ${summary}`);
  }

  const dockerCell = report.results.find((cell) => cell.id === 'monolith-fastify-postgres');
  if (!dockerCell) {
    throw new Error('matrix missing monolith-fastify-postgres cell');
  }
  if (!report.dockerEnabled) {
    if (dockerCell.status !== 'skipped') {
      throw new Error(
        'Docker cell must skip when CLI_INIT_E2E_DOCKER!=1 '
          + `(got status=${dockerCell.status})`
      );
    }
    if (!/CLI_INIT_E2E_DOCKER/.test(dockerCell.skipReason || '')) {
      throw new Error(
        `Docker skipReason must mention CLI_INIT_E2E_DOCKER (got ${dockerCell.skipReason})`
      );
    }
  }
}
