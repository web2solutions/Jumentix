/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const {
  runDoctor,
  printDoctorHelp,
  buildDoctorReport,
  formatDoctorReport
} = require('../dist/commands/doctor');

function scratch(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cli-init-doctor-${label}-`));
}

function healthyProbe() {
  return {
    run(command: string) {
      if (command === 'bun') {
        return { status: 0, stdout: '1.3.13\n', stderr: '' };
      }
      if (command === 'node') {
        return { status: 0, stdout: 'v22.0.0\n', stderr: '' };
      }
      if (command === 'docker') {
        return { status: 0, stdout: '27.0.0\n', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: 'missing' };
    }
  };
}

function writeProjectScaffold(
  root: string,
  options: {
    files?: Record<string, string>;
    mode?: string;
    templateVersion?: number;
    templateCommit?: string;
    services?: Array<{ id: string }>;
    frontend?: boolean;
  } = {}
): void {
  const files = options.files || { 'README.md': '# demo\n' };
  const manifestFiles: Record<string, { sha256: string }> = {};
  for (const [rel, content] of Object.entries(files)) {
    const absolute = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
    manifestFiles[rel] = {
      sha256: crypto.createHash('sha256').update(content).digest('hex')
    };
  }

  const services = options.services || [{ id: 'core' }];
  for (const service of services) {
    fs.mkdirSync(path.join(root, 'apps', service.id), { recursive: true });
  }
  if (options.frontend) {
    fs.mkdirSync(path.join(root, 'apps', 'frontend'), { recursive: true });
  }

  const mode = options.mode || 'monolith';
  fs.mkdirSync(path.join(root, '.jumentix'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.jumentix', 'project.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      cliVersion: '0.0.0',
      template: {
        version: options.templateVersion ?? 1,
        commit: options.templateCommit || 'test'
      },
      mode,
      plan: {
        mode,
        services: services.map((service) => ({
          id: service.id,
          kind: service.id === 'core' ? 'core' : 'domain',
          domains: [],
          interfaces: { http: 'express', realtime: 'none' },
          db: 'sqlite'
        })),
        domains: [],
        frontend: options.frontend
          ? { modules: [], offline: false }
          : undefined,
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

describe('doctor help (JUM-852)', () => {
  it('printDoctorHelp documents env and project checks', () => {
    expect.hasAssertions();
    const lines: string[] = [];
    printDoctorHelp((message = '') => {
      lines.push(message);
    });
    const text = lines.join('\n');
    expect(text).toContain('environment');
    expect(text).toContain('manifest drift');
    expect(text).toContain('Exit codes');
  });
});

describe('doctor environment and project diagnostics (JUM-852)', () => {
  it('exits 0 for a healthy scaffolded project', async () => {
    expect.hasAssertions();
    const dir = scratch('healthy');
    try {
      writeProjectScaffold(dir, {
        files: { 'README.md': '# ok\n' },
        services: [{ id: 'core' }]
      });
      const messages: string[] = [];
      const code = await runDoctor({
        help: false,
        workingDirectory: dir,
        probe: healthyProbe(),
        log: (message = '') => {
          messages.push(message);
        }
      });
      expect(code).toBe(0);
      expect(messages.join('\n')).toContain('Healthy');
      expect(messages.join('\n')).toContain('mode=monolith');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits non-zero when project.json is missing', async () => {
    expect.hasAssertions();
    const dir = scratch('missing-meta');
    try {
      const messages: string[] = [];
      const code = await runDoctor({
        help: false,
        workingDirectory: dir,
        probe: healthyProbe(),
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

  it('reports manifest drift and missing apps as blockers', async () => {
    expect.hasAssertions();
    const dir = scratch('drift-apps');
    try {
      writeProjectScaffold(dir, {
        files: { 'README.md': '# base\n' },
        services: [{ id: 'core' }, { id: 'billing' }],
        frontend: true,
        mode: 'hybrid'
      });
      fs.writeFileSync(path.join(dir, 'README.md'), '# edited\n', 'utf8');
      fs.rmSync(path.join(dir, 'apps', 'billing'), { recursive: true, force: true });

      const report = buildDoctorReport({
        workingDirectory: dir,
        probe: healthyProbe()
      });
      const text = formatDoctorReport(report);
      expect(report.blockers).toBeGreaterThanOrEqual(2);
      expect(text).toContain('manifest drift');
      expect(text).toContain('apps/billing');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flags template version mismatch against CLI templates', async () => {
    expect.hasAssertions();
    const dir = scratch('template-mismatch');
    try {
      writeProjectScaffold(dir, {
        files: { 'README.md': '# ok\n' },
        templateVersion: 99,
        services: [{ id: 'core' }]
      });
      const code = await runDoctor({
        help: false,
        workingDirectory: dir,
        probe: healthyProbe(),
        log: () => undefined
      });
      const report = buildDoctorReport({
        workingDirectory: dir,
        probe: healthyProbe()
      });
      expect(code).toBe(1);
      expect(report.findings.some((f: { code: string }) => f.code === 'template-version-mismatch'))
        .toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
