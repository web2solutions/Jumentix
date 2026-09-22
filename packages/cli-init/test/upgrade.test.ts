/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const { parseArgv } = require('../dist/args');
const { runUpgrade, printUpgradeHelp } = require('../dist/commands/upgrade');
const {
  planFileUpgrade,
  threeWayMerge,
  sha256Text
} = require('../dist/upgrade/threeWay');

function scratch(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cli-init-upgrade-${label}-`));
}

function writeProjectScaffold(root: string, files: Record<string, string>): void {
  const manifestFiles: Record<string, { sha256: string }> = {};
  for (const [rel, content] of Object.entries(files)) {
    const absolute = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
    const digest = crypto.createHash('sha256').update(content).digest('hex');
    manifestFiles[rel] = { sha256: digest };
    const objectPath = path.join(root, '.jumentix', 'objects', digest);
    fs.mkdirSync(path.dirname(objectPath), { recursive: true });
    fs.writeFileSync(objectPath, content, 'utf8');
  }
  fs.mkdirSync(path.join(root, '.jumentix'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.jumentix', 'project.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      cliVersion: '0.0.0',
      template: { version: 1, commit: 'test' },
      mode: 'monolith',
      plan: {
        mode: 'monolith',
        services: [],
        domains: [],
        contracts: { oasPerService: {} }
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, '.jumentix', 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      files: manifestFiles
    }, null, 2)}\n`,
    'utf8'
  );
}

describe('upgrade help and metadata (JUM-851)', () => {
  it('printUpgradeHelp documents dry-run and force', () => {
    expect.hasAssertions();
    const lines: string[] = [];
    printUpgradeHelp((message = '') => {
      lines.push(message);
    });
    const text = lines.join('\n');
    expect(text).toContain('--dry-run');
    expect(text).toContain('--force');
    expect(text).toContain('manifest.json');
  });

  it('refuses when .jumentix/project.json is missing', async () => {
    expect.hasAssertions();
    const dir = scratch('missing-meta');
    try {
      const messages: string[] = [];
      const code = await runUpgrade({
        help: false,
        dryRun: false,
        workingDirectory: dir,
        incomingFiles: {},
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

  it('parses upgrade --dry-run and --force', () => {
    expect.hasAssertions();
    const parsed = parseArgv(['upgrade', '--dry-run', '--force']);
    expect(parsed.command).toBe('upgrade');
    expect(parsed.dryRun).toBe(true);
    expect(parsed.init.force).toBe(true);
  });
});

describe('upgrade three-way merge helpers (JUM-851)', () => {
  it('auto-merges non-overlapping edits and flags conflicts', () => {
    expect.hasAssertions();
    const base = 'line-a\nline-b\nline-c\nline-d\nline-e\n';
    const ours = 'line-a\nline-b-user\nline-c\nline-d\nline-e\n';
    const theirs = 'line-a\nline-b\nline-c\nline-d-template\nline-e\n';
    const merged = threeWayMerge(base, ours, theirs);
    expect(merged.conflicted).toBe(false);
    expect(merged.content).toContain('line-b-user');
    expect(merged.content).toContain('line-d-template');

    const clash = planFileUpgrade({
      relPath: 'clash.txt',
      baseHash: sha256Text(base),
      baseContent: base,
      oursContent: 'alpha\n',
      theirsContent: 'beta\n'
    });
    expect(clash.status).toBe('conflicted');
  });
});

describe('upgrade command apply / dry-run (JUM-851)', () => {
  it('dry-run reports updates without writing', async () => {
    expect.hasAssertions();
    const dir = scratch('dry');
    try {
      writeProjectScaffold(dir, {
        'README.md': '# hello\n',
        'keep.txt': 'stable\n'
      });
      const before = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
      const messages: string[] = [];
      const code = await runUpgrade({
        help: false,
        dryRun: true,
        force: true,
        workingDirectory: dir,
        incomingFiles: {
          'README.md': '# hello upgraded\n',
          'keep.txt': 'stable\n'
        },
        log: (message = '') => {
          messages.push(message);
        }
      });
      expect(code).toBe(0);
      expect(messages.join('\n')).toContain('updated: 1');
      expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')).toBe(before);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies auto-merge and leaves conflict markers', async () => {
    expect.hasAssertions();
    const dir = scratch('apply');
    try {
      const baseA = 'shared\nkeep-mid\nbase-tail\nend\n';
      const baseB = 'only-base\n';
      writeProjectScaffold(dir, {
        'a.txt': baseA,
        'b.txt': baseB
      });
      fs.writeFileSync(path.join(dir, 'a.txt'), 'shared\nuser-mid\nbase-tail\nend\n', 'utf8');
      fs.writeFileSync(path.join(dir, 'b.txt'), 'user-only\n', 'utf8');

      const code = await runUpgrade({
        help: false,
        dryRun: false,
        force: true,
        workingDirectory: dir,
        incomingFiles: {
          'a.txt': 'shared\nkeep-mid\nbase-tail\ntemplate-end\n',
          'b.txt': 'template-only\n'
        },
        log: () => undefined
      });
      expect(code).toBe(1);
      const mergedA = fs.readFileSync(path.join(dir, 'a.txt'), 'utf8');
      expect(mergedA).toContain('user-mid');
      expect(mergedA).toContain('template-end');
      expect(fs.readFileSync(path.join(dir, 'b.txt'), 'utf8')).toContain('<<<<<<<');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
