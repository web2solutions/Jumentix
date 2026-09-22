/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { findSpecs, findWorkerEntries, runCypress } = require('../../scripts/run-browser-tests');

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
});
