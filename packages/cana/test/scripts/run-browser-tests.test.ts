/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  BUILD_DIR,
  bundle,
  bundlePath,
  buildAll,
  findSpecs,
  findWorkerEntries,
  main,
  run,
  runCypress
} = require('../../scripts/run-browser-tests');

describe('run-browser-tests discovery', () => {
  it('includes only package-owned Cypress specs and workers', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-browser-specs-'));

    try {
      const canaSpec = path.join(root, 'cana', 'cypress', 'e2e', 'indexed-db.cy.ts');
      const canaWorker = path.join(root, 'cana', 'cypress', 'support', 'sync-worker.ts');
      const cliTemplateSpec = path.join(root, 'cli-init', 'templates', 'frontend', 'cypress', 'e2e', 'app.cy.ts');
      const cliTemplateWorker = path.join(root, 'cli-init', 'templates', 'frontend', 'cypress', 'support', 'app-worker.ts');
      for (const file of [canaSpec, canaWorker, cliTemplateSpec, cliTemplateWorker]) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'export {};\n');
      }

      expect(findSpecs(root)).toStrictEqual([canaSpec]);
      expect(findWorkerEntries(root)).toStrictEqual([canaWorker]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('retries a transient browser startup once and still fails closed', () => {
    expect.hasAssertions();
    const spawn = jest.fn()
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 });

    expect(runCypress(spawn, 'firefox', { PATH: process.env.PATH })).toStrictEqual({ status: 0 });
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('returns the final startup failure after exhausting the retry budget', () => {
    expect.hasAssertions();
    const failure = { error: new Error('browser binary missing') };
    const spawn = jest.fn().mockReturnValue(failure);

    expect(runCypress(spawn, 'webkit', {}, 2)).toBe(failure);
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it('bundles browser inputs, records bundle failures, and keeps paths package-scoped', () => {
    expect.hasAssertions();
    const spec = path.join(process.cwd(), 'packages', 'cana', 'cypress', 'e2e', 'spec.cy.ts');
    const output = bundlePath(spec);
    const spawn = jest.fn().mockReturnValue({ status: 0, stderr: '', stdout: '' });

    expect(output).toBe(path.join(BUILD_DIR, 'cana', 'spec.cy.js'));
    expect(bundle(spec, spawn, { instrument: false })).toStrictEqual({ ok: true, output });
    expect(buildAll([spec], jest.fn().mockReturnValue({
      status: 1,
      stderr: 'syntax error',
      stdout: ''
    }), { instrument: false })).toStrictEqual([
      expect.stringContaining('Failed to bundle packages/cana/cypress/e2e/spec.cy.ts')
    ]);
  });

  it('fails before Cypress when browser inputs are absent, unsupported, or cannot bundle', () => {
    expect.hasAssertions();
    const spec = path.join(process.cwd(), 'packages', 'cana', 'cypress', 'e2e', 'spec.cy.ts');

    expect(run({ specs: [] })).toMatchObject({ ok: false, message: expect.stringContaining('No browser specs') });
    expect(run({ specs: [spec], browser: 'electron' })).toMatchObject({
      ok: false,
      message: expect.stringContaining('Unsupported browser')
    });
    expect(run({
      specs: [spec],
      workers: [],
      spawn: jest.fn().mockReturnValue({ status: 1, stderr: 'bundle failed', stdout: '' })
    })).toMatchObject({ ok: false, message: expect.stringContaining('Failed to bundle') });
  });

  it('reports Cypress startup and exit failures after bundling browser inputs', () => {
    expect.hasAssertions();
    const spec = path.join(process.cwd(), 'packages', 'cana', 'cypress', 'e2e', 'spec.cy.ts');
    const startupFailure = jest.fn()
      .mockReturnValueOnce({ status: 0, stderr: '', stdout: '' })
      .mockReturnValue({ error: new Error('missing browser') });
    const exitFailure = jest.fn()
      .mockReturnValueOnce({ status: 0, stderr: '', stdout: '' })
      .mockReturnValue({ status: 17 });

    expect(run({
      specs: [spec], workers: [], spawn: startupFailure, instrument: false
    })).toMatchObject({ ok: false, message: expect.stringContaining('Cypress failed to start') });
    expect(run({
      specs: [spec], workers: [], spawn: exitFailure, instrument: false
    })).toMatchObject({ ok: false, message: expect.stringContaining('Cypress exited with status 17') });
  });

  it('writes browser evidence after a successful run and reports outcomes through main', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-browser-evidence-'));
    const evidencePath = path.join(dir, 'browser-matrix.json');
    const spec = path.join(process.cwd(), 'packages', 'cana', 'cypress', 'e2e', 'spec.cy.ts');
    const spawn = jest.fn()
      .mockReturnValueOnce({ status: 0, stderr: '', stdout: '' })
      .mockReturnValue({ status: 0 });
    const io = { log: jest.fn(), error: jest.fn() };

    try {
      expect(run({
        specs: [spec],
        workers: [],
        spawn,
        instrument: false,
        evidencePath,
        writeCoverage: () => ({ ok: true, message: 'coverage written' })
      })).toMatchObject({ ok: true, message: expect.stringContaining('coverage written') });
      expect(JSON.parse(fs.readFileSync(evidencePath, 'utf8'))).toMatchObject({
        browser: 'chrome', specs: 1, coverage: 'coverage/browser'
      });
      expect(main(io, () => ({ ok: true, message: 'passed' }))).toBe(0);
      expect(main(io, () => ({ ok: false, message: 'failed' }))).toBe(1);
      expect(io.log).toHaveBeenCalledWith('passed');
      expect(io.error).toHaveBeenCalledWith('failed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
