import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type UpgradeFileStatus = 'updated' | 'conflicted' | 'skipped' | 'added' | 'removed';

export type UpgradeFileResult = {
  path: string;
  status: UpgradeFileStatus;
  content: string | null;
};

export type UpgradeReport = {
  updated: string[];
  conflicted: string[];
  skipped: string[];
  added: string[];
  removed: string[];
};

export function sha256Text(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Three-way merge via `git merge-file -p`. Returns conflict markers when edits
 * overlap. Falls back to a labeled two-way conflict block when git is missing.
 */
export function threeWayMerge(base: string, ours: string, theirs: string): {
  content: string;
  conflicted: boolean;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jumentix-merge-'));
  try {
    const basePath = path.join(dir, 'base');
    const oursPath = path.join(dir, 'ours');
    const theirsPath = path.join(dir, 'theirs');
    fs.writeFileSync(basePath, base, 'utf8');
    fs.writeFileSync(oursPath, ours, 'utf8');
    fs.writeFileSync(theirsPath, theirs, 'utf8');
    const result = spawnSync(
      '/usr/bin/git',
      [
        'merge-file',
        '-p',
        '-L',
        'current',
        '-L',
        'base',
        '-L',
        'template',
        oursPath,
        basePath,
        theirsPath
      ],
      { encoding: 'utf8' }
    );
    if (result.error || result.status === null) {
      return {
        content: [
          '<<<<<<< current',
          ours.replace(/\n$/, ''),
          '=======',
          theirs.replace(/\n$/, ''),
          '>>>>>>> template',
          ''
        ].join('\n'),
        conflicted: true
      };
    }
    return {
      content: result.stdout ?? '',
      conflicted: (result.status ?? 1) > 0
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Classify and (optionally) merge one path using manifest baseline hash vs
 * current bytes vs incoming template bytes.
 */
export function planFileUpgrade(input: {
  relPath: string;
  baseHash: string | undefined;
  baseContent: string | null;
  oursContent: string | null;
  theirsContent: string | null;
}): UpgradeFileResult {
  const {
    relPath,
    baseHash,
    baseContent,
    oursContent,
    theirsContent
  } = input;

  if (theirsContent === null && oursContent === null) {
    return { path: relPath, status: 'skipped', content: null };
  }

  if (theirsContent === null && oursContent !== null) {
    // Template no longer emits this path — report, keep user file.
    return { path: relPath, status: 'removed', content: oursContent };
  }

  if (theirsContent !== null && oursContent === null) {
    return { path: relPath, status: 'added', content: theirsContent };
  }

  const ours = oursContent as string;
  const theirs = theirsContent as string;
  const oursHash = sha256Text(ours);
  const theirsHash = sha256Text(theirs);
  const recorded = baseHash || '';
  const userEdited = Boolean(recorded) && oursHash !== recorded;
  const templateChanged = !recorded || theirsHash !== recorded;

  if (!userEdited && !templateChanged) {
    return { path: relPath, status: 'skipped', content: ours };
  }
  if (!userEdited && templateChanged) {
    return { path: relPath, status: 'updated', content: theirs };
  }
  if (userEdited && !templateChanged) {
    return { path: relPath, status: 'skipped', content: ours };
  }

  // Both changed → three-way merge when baseline content is available.
  let base: string | null = null;
  if (baseContent !== null) {
    base = baseContent;
  } else if (recorded && oursHash === recorded) {
    base = ours;
  }
  if (base === null) {
    const conflicted = threeWayMerge('', ours, theirs);
    return {
      path: relPath,
      status: 'conflicted',
      content: conflicted.content
    };
  }
  if (sha256Text(base) === theirsHash) {
    return { path: relPath, status: 'skipped', content: ours };
  }
  if (sha256Text(base) === oursHash) {
    return { path: relPath, status: 'updated', content: theirs };
  }
  const merged = threeWayMerge(base, ours, theirs);
  return {
    path: relPath,
    status: merged.conflicted ? 'conflicted' : 'updated',
    content: merged.content
  };
}

export function summarizeResults(results: UpgradeFileResult[]): UpgradeReport {
  const report: UpgradeReport = {
    updated: [],
    conflicted: [],
    skipped: [],
    added: [],
    removed: []
  };
  for (const entry of results) {
    report[entry.status].push(entry.path);
  }
  for (const key of Object.keys(report) as Array<keyof UpgradeReport>) {
    report[key].sort((left, right) => left.localeCompare(right));
  }
  return report;
}

export function formatUpgradeReportMarkdown(input: {
  cliVersion: string;
  dryRun: boolean;
  report: UpgradeReport;
}): string {
  const { cliVersion, dryRun, report } = input;
  const section = (title: string, files: string[]): string[] => [
    `## ${title} (${files.length})`,
    '',
    ...(files.length === 0 ? ['_(none)_', ''] : files.map((file) => `- \`${file}\``).concat(['']))
  ];
  return [
    `# jumentix upgrade report (${cliVersion})`,
    '',
    dryRun ? '_Dry run — no files were written._' : '_Applied to the working tree._',
    '',
    ...section('Updated', report.updated),
    ...section('Conflicted', report.conflicted),
    ...section('Skipped', report.skipped),
    ...section('Added', report.added),
    ...section('Removed (kept on disk)', report.removed),
    ''
  ].join('\n');
}
