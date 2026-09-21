/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from '../generators';
import type { GenerationPlan } from '../sources';
import { ALLOWED_MODES } from '../sources';

const PROJECT_META = '.jumentix/project.json';
const MANIFEST_META = '.jumentix/manifest.json';
const MIN_NODE_MAJOR = 20;

type ProjectDocument = {
  schemaVersion: number;
  cliVersion: string;
  template: { version: number; commit: string };
  mode: GenerationPlan['mode'];
  plan: GenerationPlan;
  createdAt: string;
  updatedAt: string;
};

type ManifestDocument = {
  schemaVersion: number;
  generatedAt: string;
  files: Record<string, { sha256: string }>;
};

export type DoctorSeverity = 'ok' | 'warn' | 'blocker';

export type DoctorFinding = {
  area: 'environment' | 'project';
  severity: DoctorSeverity;
  code: string;
  message: string;
};

export type DoctorReport = {
  findings: DoctorFinding[];
  blockers: number;
  warnings: number;
};

export type DoctorProbe = {
  run: (
    command: string,
    args: string[]
  ) => { status: number | null; stdout: string; stderr: string };
};

const defaultProbe: DoctorProbe = {
  run(command, args) {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      env: process.env
    });
    return {
      status: result.status,
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || '')
    };
  }
};

export function printDoctorHelp(log: (message?: string) => void = console.log): void {
  log(`
jumentix doctor

Diagnose the environment and a generated project's contract files (Req 037 v2 / JUM-852).

Checks:
  environment  bun version, node (>=${MIN_NODE_MAJOR} when present), docker availability
  project      .jumentix/project.json, mode, manifest drift, missing apps,
               template version vs packaged templates.manifest.json

Exit codes: 0 healthy, 1 project blockers, 2 environment blockers.
`);
}

function readCliVersion(packageRoot: string): string {
  try {
    const raw = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version && parsed.version !== '0.0.0' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readTemplatesMeta(packageRoot: string): {
  schemaVersion: number;
  sourceCommit: string;
} {
  const manifestPath = path.join(packageRoot, 'templates.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { schemaVersion: 1, sourceCommit: '' };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      schemaVersion?: number;
      sourceCommit?: string;
    };
    return {
      schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1,
      sourceCommit: parsed.sourceCommit || ''
    };
  } catch {
    return { schemaVersion: 1, sourceCommit: '' };
  }
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/)[0] || '';
}

function parseSemverMajor(versionText: string): number | null {
  const match = versionText.match(/v?(\d+)\./);
  if (!match) return null;
  return Number(match[1]);
}

function findManifestDrift(rootDir: string, manifest: ManifestDocument): string[] {
  const drifted: string[] = [];
  for (const [rel, meta] of Object.entries(manifest.files || {})) {
    const absolute = path.join(rootDir, ...rel.split('/'));
    if (!fs.existsSync(absolute)) {
      drifted.push(rel);
    } else if (sha256File(absolute) !== meta.sha256) {
      drifted.push(rel);
    }
  }
  return drifted.sort((left, right) => left.localeCompare(right));
}

function expectedAppPaths(plan: GenerationPlan): string[] {
  const apps: string[] = [];
  if (plan.mode !== 'frontend') {
    for (const service of plan.services || []) {
      if (service?.id) apps.push(`apps/${service.id}`);
    }
  }
  const wantsFrontend = Boolean(
    plan.frontend || plan.mode === 'hybrid' || plan.mode === 'frontend'
  );
  if (wantsFrontend) apps.push('apps/frontend');
  return [...new Set(apps)].sort((left, right) => left.localeCompare(right));
}

function collectEnvironmentFindings(probe: DoctorProbe): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  const bun = probe.run('bun', ['--version']);
  if (bun.status === 0 && firstLine(bun.stdout || bun.stderr)) {
    findings.push({
      area: 'environment',
      severity: 'ok',
      code: 'bun',
      message: `bun ${firstLine(bun.stdout || bun.stderr)}`
    });
  } else {
    findings.push({
      area: 'environment',
      severity: 'blocker',
      code: 'bun-missing',
      message: 'bun is not available on PATH (required to run generated workspaces)'
    });
  }

  const node = probe.run('node', ['--version']);
  if (node.status === 0 && firstLine(node.stdout || node.stderr)) {
    const version = firstLine(node.stdout || node.stderr);
    const major = parseSemverMajor(version);
    if (major !== null && major < MIN_NODE_MAJOR) {
      findings.push({
        area: 'environment',
        severity: 'warn',
        code: 'node-old',
        message: `node ${version} is below engines.node (>=${MIN_NODE_MAJOR})`
      });
    } else {
      findings.push({
        area: 'environment',
        severity: 'ok',
        code: 'node',
        message: `node ${version}`
      });
    }
  } else {
    findings.push({
      area: 'environment',
      severity: 'warn',
      code: 'node-missing',
      message: `node not on PATH (optional; engines.node >=${MIN_NODE_MAJOR} when present)`
    });
  }

  const docker = probe.run('docker', ['version', '--format', '{{.Server.Version}}']);
  const dockerAlt = docker.status === 0
    ? docker
    : probe.run('docker', ['--version']);
  if (dockerAlt.status === 0) {
    const version = firstLine(dockerAlt.stdout || dockerAlt.stderr) || 'available';
    findings.push({
      area: 'environment',
      severity: 'ok',
      code: 'docker',
      message: `docker ${version}`
    });
  } else {
    findings.push({
      area: 'environment',
      severity: 'warn',
      code: 'docker-missing',
      message: 'docker is not available (needed for compose-backed databases)'
    });
  }

  return findings;
}

function collectProjectFindings(options: {
  rootDir: string;
  packageRoot: string;
}): DoctorFinding[] {
  const { rootDir, packageRoot } = options;
  const findings: DoctorFinding[] = [];
  const projectPath = path.join(rootDir, ...PROJECT_META.split('/'));

  if (!fs.existsSync(projectPath)) {
    findings.push({
      area: 'project',
      severity: 'blocker',
      code: 'project-missing',
      message: `missing ${PROJECT_META} (run inside a project created by jumentix init)`
    });
    return findings;
  }

  let project: ProjectDocument;
  try {
    project = JSON.parse(fs.readFileSync(projectPath, 'utf8')) as ProjectDocument;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    findings.push({
      area: 'project',
      severity: 'blocker',
      code: 'project-invalid',
      message: `${PROJECT_META} is not valid JSON: ${detail}`
    });
    return findings;
  }

  const mode = project.mode || project.plan?.mode;
  if (!mode || !ALLOWED_MODES.includes(mode)) {
    findings.push({
      area: 'project',
      severity: 'blocker',
      code: 'mode-invalid',
      message: `${PROJECT_META} has invalid mode "${String(mode || '')}"`
    });
  } else {
    findings.push({
      area: 'project',
      severity: 'ok',
      code: 'project',
      message: `${PROJECT_META} present (mode=${mode}, cli=${project.cliVersion || 'unknown'})`
    });
  }

  const templates = readTemplatesMeta(packageRoot);
  const projectTemplateVersion = project.template?.version;
  const projectTemplateCommit = project.template?.commit || '';
  if (
    typeof projectTemplateVersion === 'number'
    && projectTemplateVersion !== templates.schemaVersion
  ) {
    findings.push({
      area: 'project',
      severity: 'blocker',
      code: 'template-version-mismatch',
      message: `template version mismatch: project=${projectTemplateVersion}, `
        + `cli=${templates.schemaVersion} (run jumentix upgrade)`
    });
  } else if (
    templates.sourceCommit
    && projectTemplateCommit
    && projectTemplateCommit !== 'unknown'
    && projectTemplateCommit !== 'test'
    && projectTemplateCommit !== templates.sourceCommit
  ) {
    findings.push({
      area: 'project',
      severity: 'warn',
      code: 'template-commit-drift',
      message: `template commit differs: project=${projectTemplateCommit.slice(0, 12)}, `
        + `cli=${templates.sourceCommit.slice(0, 12)} (consider jumentix upgrade)`
    });
  } else {
    findings.push({
      area: 'project',
      severity: 'ok',
      code: 'template-version',
      message: `template version ${projectTemplateVersion ?? templates.schemaVersion} `
        + `matches CLI package (${readCliVersion(packageRoot)})`
    });
  }

  const { plan } = project;
  if (plan) {
    const missingApps = expectedAppPaths(plan).filter((rel) => {
      const absolute = path.join(rootDir, ...rel.split('/'));
      return !fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory();
    });
    if (missingApps.length > 0) {
      findings.push({
        area: 'project',
        severity: 'blocker',
        code: 'apps-missing',
        message: `missing app directories: ${missingApps.join(', ')}`
      });
    } else if (expectedAppPaths(plan).length > 0) {
      findings.push({
        area: 'project',
        severity: 'ok',
        code: 'apps',
        message: `expected apps present (${expectedAppPaths(plan).join(', ')})`
      });
    }
  }

  const manifestPath = path.join(rootDir, ...MANIFEST_META.split('/'));
  if (!fs.existsSync(manifestPath)) {
    findings.push({
      area: 'project',
      severity: 'blocker',
      code: 'manifest-missing',
      message: `missing ${MANIFEST_META}`
    });
  } else {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestDocument;
      const drifted = findManifestDrift(rootDir, manifest);
      if (drifted.length > 0) {
        const preview = drifted.slice(0, 8).join(', ');
        const extra = drifted.length > 8 ? `, …(+${drifted.length - 8})` : '';
        findings.push({
          area: 'project',
          severity: 'blocker',
          code: 'manifest-drift',
          message: `manifest drift (${drifted.length}): ${preview}${extra}`
        });
      } else {
        findings.push({
          area: 'project',
          severity: 'ok',
          code: 'manifest',
          message: `${MANIFEST_META} matches on-disk generated files`
        });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      findings.push({
        area: 'project',
        severity: 'blocker',
        code: 'manifest-invalid',
        message: `${MANIFEST_META} is not valid JSON: ${detail}`
      });
    }
  }

  return findings;
}

export function summarizeFindings(findings: DoctorFinding[]): DoctorReport {
  return {
    findings,
    blockers: findings.filter((f) => f.severity === 'blocker').length,
    warnings: findings.filter((f) => f.severity === 'warn').length
  };
}

function mark(severity: DoctorSeverity): string {
  if (severity === 'ok') return 'ok';
  if (severity === 'warn') return 'warn';
  return 'FAIL';
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = ['jumentix doctor', ''];
  const sections: Array<'environment' | 'project'> = ['environment', 'project'];
  for (const area of sections) {
    const title = area === 'environment' ? 'Environment' : 'Project';
    lines.push(`${title}:`);
    const items = report.findings.filter((f) => f.area === area);
    if (items.length === 0) {
      lines.push('  (no checks)');
    } else {
      for (const item of items) {
        lines.push(`  [${mark(item.severity)}] ${item.message}`);
      }
    }
    lines.push('');
  }
  if (report.blockers === 0) {
    lines.push(
      report.warnings > 0
        ? `Healthy with ${report.warnings} warning(s).`
        : 'Healthy — no blockers.'
    );
  } else {
    const warningSuffix = report.warnings > 0
      ? `, ${report.warnings} warning(s)`
      : '';
    lines.push(`Unhealthy — ${report.blockers} blocker(s)${warningSuffix}.`);
  }
  return lines.join('\n');
}

export function buildDoctorReport(options: {
  workingDirectory?: string;
  packageRoot?: string;
  probe?: DoctorProbe;
}): DoctorReport {
  const rootDir = path.resolve(options.workingDirectory || process.cwd());
  const packageRoot = options.packageRoot || path.resolve(__dirname, '..', '..');
  const probe = options.probe || defaultProbe;
  const findings = [
    ...collectEnvironmentFindings(probe),
    ...collectProjectFindings({ rootDir, packageRoot })
  ];
  return summarizeFindings(findings);
}

export async function runDoctor(options: {
  help: boolean;
  workingDirectory?: string;
  packageRoot?: string;
  probe?: DoctorProbe;
  log?: (message?: string) => void;
}): Promise<number> {
  const { help, log = console.log } = options;
  if (help) {
    printDoctorHelp(log);
    return 0;
  }

  const report = buildDoctorReport({
    workingDirectory: options.workingDirectory,
    packageRoot: options.packageRoot,
    probe: options.probe
  });
  log(formatDoctorReport(report));

  if (report.blockers === 0) return 0;
  const hasEnvBlocker = report.findings.some(
    (f) => f.area === 'environment' && f.severity === 'blocker'
  );
  return hasEnvBlocker ? 2 : 1;
}
