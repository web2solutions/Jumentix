/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

require('./ensure-built');

const { parseArgv, looksLikeLegacyInvocation, mapLegacyServiceTypeToMode } = require('../dist/args');
const { main, printRootHelp } = require('../dist/cli');
const { readInitConfig, writeInitConfig } = require('../dist/config');

describe('command router (JUM-844)', () => {
  it('root help lists every command', async () => {
    expect.hasAssertions();
    const lines: string[] = [];
    const code = await main(['--help'], (message = '') => {
      lines.push(message);
    });
    const text = lines.join('\n');
    expect(code).toBe(0);
    expect(text).toContain('init');
    expect(text).toContain('add');
    expect(text).toContain('upgrade');
    expect(text).toContain('doctor');
  });

  it('printRootHelp names every command without running main', () => {
    expect.hasAssertions();
    const lines: string[] = [];
    printRootHelp((message = '') => {
      lines.push(message);
    });
    const text = lines.join('\n');
    expect(text).toContain('init');
    expect(text).toContain('add');
    expect(text).toContain('upgrade');
    expect(text).toContain('doctor');
  });

  it('legacy service-type argv is detected and routed to init', () => {
    expect.hasAssertions();
    const argv = ['--non-interactive', '--service-type=rest', '--project-name=demo'];
    expect(looksLikeLegacyInvocation(argv)).toBe(true);
    const parsed = parseArgv(argv);
    expect(parsed.command).toBe('init');
    expect(parsed.init.legacyInvocation).toBe(true);
    expect(parsed.init.serviceType).toBe('rest');
    expect(mapLegacyServiceTypeToMode('rest')).toStrictEqual({ mode: 'monolith', http: 'express' });
  });

  it('add without subcommand prints help and exits 1', async () => {
    expect.hasAssertions();
    const code = await main(['add'], () => undefined);
    expect(code).toBe(1);
  });

  it('doctor --help exits 0', async () => {
    expect.hasAssertions();
    const code = await main(['doctor', '--help'], () => undefined);
    expect(code).toBe(0);
  });
});

describe('jumentix.init.json round-trip (JUM-844)', () => {
  it('write and read preserve mode and project name', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-config-'));
    try {
      const written = writeInitConfig(dir, {
        mode: 'monolith',
        http: 'express',
        projectName: 'demo',
        nonInteractive: true
      });
      expect(written.endsWith('jumentix.init.json')).toBe(true);
      const read = readInitConfig(written);
      expect(read.mode).toBe('monolith');
      expect(read.projectName).toBe('demo');
      expect(read.http).toBe('express');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('main merges --config into init flags', async () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-init-config-main-'));
    try {
      const configPath = writeInitConfig(dir, {
        mode: 'services',
        preset: 'users',
        projectName: 'from-config'
      });
      const messages: string[] = [];
      const code = await main(
        ['init', '--non-interactive', `--config=${configPath}`, '--install-deps=false'],
        (message = '') => {
          messages.push(message);
        }
      );
      expect(code).toBe(1);
      expect(messages.join('\n')).toContain('not implemented yet');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
