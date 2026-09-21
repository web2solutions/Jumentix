/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assembleWorkspace,
  buildManifestJson,
  buildProjectJson,
  generateBackend,
  generateFrontend,
  listGeneratedFiles,
  readBaselineObject,
  sha256File,
  writeBaselineObjects
} from '../generators';
import type { GenerationPlan } from '../sources';
import {
  formatUpgradeReportMarkdown,
  planFileUpgrade,
  summarizeResults,
  type UpgradeFileResult,
  type UpgradeReport
} from '../upgrade/threeWay';

const PROJECT_META = '.jumentix/project.json';
const MANIFEST_META = '.jumentix/manifest.json';

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

export function printUpgradeHelp(log: (message?: string) => void = console.log): void {
  log(`
jumentix upgrade [--dry-run] [--force]

Apply a template three-way merge using .jumentix/manifest.json (Req 037 v2 / JUM-851).

Options:
  --dry-run   Print the updated/conflicted/skipped report without writing
  --force     Allow upgrade when the git working tree is dirty

Requires .jumentix/project.json and .jumentix/manifest.json. Baseline blobs under
.jumentix/objects/<sha256> enable clean auto-merges when both sides changed.
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

function readTemplatesCommit(packageRoot: string): string {
  const manifestPath = path.join(packageRoot, 'templates.manifest.json');
  if (!fs.existsSync(manifestPath)) return '';
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      sourceCommit?: string;
    };
    return parsed.sourceCommit || '';
  } catch {
    return '';
  }
}

function loadProjectDocument(rootDir: string): ProjectDocument {
  const projectPath = path.join(rootDir, ...PROJECT_META.split('/'));
  if (!fs.existsSync(projectPath)) {
    throw new Error(
      `Missing ${PROJECT_META}. Run this command inside a project created by `
      + '`jumentix init` (or pass the project directory as cwd).'
    );
  }
  return JSON.parse(fs.readFileSync(projectPath, 'utf8')) as ProjectDocument;
}

function loadManifestDocument(rootDir: string): ManifestDocument {
  const manifestPath = path.join(rootDir, ...MANIFEST_META.split('/'));
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing ${MANIFEST_META}. Re-run \`jumentix init\` or restore the `
      + 'generated-file hash manifest before upgrading.'
    );
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ManifestDocument;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function isGitWorkingTreeDirty(rootDir: string): boolean {
  if (!fs.existsSync(path.join(rootDir, '.git'))) return false;
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  if (result.status !== 0) return false;
  return String(result.stdout || '').trim().length > 0;
}

function readTextIfExists(absolute: string): string | null {
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
  return fs.readFileSync(absolute, 'utf8');
}

function shouldSkipUpgradePath(rel: string): boolean {
  if (rel === MANIFEST_META) return true;
  if (rel.startsWith('.jumentix/upgrade-')) return true;
  if (rel.startsWith('.jumentix/objects/')) return true;
  return false;
}

function loadTreeFiles(rootDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of listGeneratedFiles(rootDir)) {
    if (!shouldSkipUpgradePath(rel)) {
      const absolute = path.join(rootDir, ...rel.split('/'));
      if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
        out[rel] = fs.readFileSync(absolute, 'utf8');
      }
    }
  }
  return out;
}

/**
 * Regenerate the project into a temp directory with the current CLI templates
 * and return the resulting file map (incoming / "theirs").
 */
async function regenerateIncoming(options: {
  plan: GenerationPlan;
  projectName: string;
  packageRoot: string;
  log: (message?: string) => void;
}): Promise<Record<string, string>> {
  const {
    plan,
    projectName,
    packageRoot,
    log
  } = options;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-upgrade-'));
  try {
    const hasBackend = plan.mode !== 'frontend' && plan.services.length > 0;
    const hasFrontend = Boolean(
      plan.frontend || plan.mode === 'hybrid' || plan.mode === 'frontend'
    );
    if (hasBackend) {
      await generateBackend({
        plan,
        outputDir: tempRoot,
        projectName,
        log: () => undefined
      });
    }
    if (hasFrontend) {
      await generateFrontend({
        plan,
        outputDir: tempRoot,
        projectName,
        log: () => undefined
      });
    }
    await assembleWorkspace({
      outputDir: tempRoot,
      projectName,
      plan,
      answers: {
        projectName,
        mode: plan.mode,
        frontend: hasFrontend,
        offline: Boolean(plan.frontend?.offline)
      },
      install: false,
      git: false,
      packageRoot,
      log: () => undefined
    });
    log('Regenerated template cohort for three-way comparison.');
    return loadTreeFiles(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function printReport(log: (message?: string) => void, report: UpgradeReport): void {
  const line = (label: string, files: string[]): void => {
    log(`${label}: ${files.length}`);
    for (const file of files) log(`  - ${file}`);
  };
  line('updated', report.updated);
  line('conflicted', report.conflicted);
  line('skipped', report.skipped);
  line('added', report.added);
  line('removed', report.removed);
}

export async function runUpgrade(options: {
  help: boolean;
  dryRun: boolean;
  force?: boolean;
  workingDirectory?: string;
  packageRoot?: string;
  /** Test / advanced hook: project-relative path → new template content. */
  incomingFiles?: Record<string, string>;
  log?: (message?: string) => void;
}): Promise<number> {
  const {
    help,
    dryRun,
    force = false,
    workingDirectory = process.cwd(),
    incomingFiles,
    log = console.log
  } = options;

  if (help) {
    printUpgradeHelp(log);
    return 0;
  }

  const rootDir = path.resolve(workingDirectory);
  const packageRoot = options.packageRoot || path.resolve(__dirname, '..', '..');

  let project: ProjectDocument;
  let manifest: ManifestDocument;
  try {
    project = loadProjectDocument(rootDir);
    manifest = loadManifestDocument(rootDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\nError: ${message}`);
    return 1;
  }

  if (!force && isGitWorkingTreeDirty(rootDir)) {
    log(
      'Refusing to upgrade: git working tree is dirty. '
      + 'Commit or stash changes, or pass --force.'
    );
    return 1;
  }

  const projectName = path.basename(rootDir);
  let incoming: Record<string, string>;
  try {
    incoming = incomingFiles
      || await regenerateIncoming({
        plan: project.plan,
        projectName,
        packageRoot,
        log
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\nError: failed to build incoming template tree: ${message}`);
    return 1;
  }

  const paths = new Set([
    ...Object.keys(manifest.files || {}),
    ...Object.keys(incoming)
  ]);

  const results: UpgradeFileResult[] = [];
  for (const rel of [...paths].sort()) {
    if (!shouldSkipUpgradePath(rel)) {
      const baseHash = manifest.files?.[rel]?.sha256;
      const absolute = path.join(rootDir, ...rel.split('/'));
      const oursContent = readTextIfExists(absolute);
      const theirsContent = Object.prototype.hasOwnProperty.call(incoming, rel)
        ? incoming[rel]
        : null;
      const baseContent = baseHash ? readBaselineObject(rootDir, baseHash) : null;

      results.push(planFileUpgrade({
        relPath: rel,
        baseHash,
        baseContent,
        oursContent,
        theirsContent
      }));
    }
  }

  const report = summarizeResults(results);
  const cliVersion = readCliVersion(packageRoot);
  printReport(log, report);

  if (dryRun) {
    log('\nDry run complete — no files written.');
    return report.conflicted.length > 0 ? 1 : 0;
  }

  for (const entry of results) {
    if (entry.status !== 'skipped' && entry.status !== 'removed' && entry.content !== null) {
      const absolute = path.join(rootDir, ...entry.path.split('/'));
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, entry.content, 'utf8');
    }
  }

  const reportBody = formatUpgradeReportMarkdown({
    cliVersion,
    dryRun: false,
    report
  });
  const reportName = `upgrade-${cliVersion.replace(/[^\w.-]+/g, '_')}.md`;
  const reportPath = path.join(rootDir, '.jumentix', reportName);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, reportBody, 'utf8');
  log(`Wrote ${path.relative(rootDir, reportPath)}`);

  const now = new Date().toISOString();
  writeJson(
    path.join(rootDir, ...PROJECT_META.split('/')),
    buildProjectJson({
      cliVersion,
      templateCommit: readTemplatesCommit(packageRoot) || project.template?.commit || '',
      templateSchemaVersion: project.template?.version,
      plan: project.plan,
      createdAt: project.createdAt || now,
      updatedAt: now
    })
  );

  const nextManifest = buildManifestJson(rootDir);
  writeJson(path.join(rootDir, ...MANIFEST_META.split('/')), nextManifest);
  writeBaselineObjects(rootDir, nextManifest.files);

  log(
    `Upgrade applied (${report.updated.length} updated, `
    + `${report.conflicted.length} conflicted, ${report.added.length} added).`
  );
  return report.conflicted.length > 0 ? 1 : 0;
}

/** Test helper: hash a file on disk (re-export shape used by suites). */
export function hashFile(filePath: string): string {
  return sha256File(filePath);
}
