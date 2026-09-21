/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
/**
 * Generation e2e matrix suite (JUM-854).
 *
 * Always exercises non-Docker cells (at least monolith/express/sqlite).
 * Docker cells skip with a named reason unless CLI_INIT_E2E_DOCKER=1 and Docker
 * is available.
 */
import path from 'node:path';

require('../ensure-built');

const {
  GENERATION_MATRIX,
  runGenerationMatrix,
  assertMatrixAcceptable,
  formatMatrixReport
} = require('./run-generation-matrix');

const packageRoot = path.join(__dirname, '..', '..');

const EXPECTED_CELL_IDS = [
  'monolith-express-sqlite',
  'monolith-fastify-postgres',
  'services-core-domain',
  'hybrid-express-sqlite',
  'frontend-only',
  'hybrid-offline'
];

describe('cli-init generation e2e matrix (JUM-854)', () => {
  it('defines the factory matrix including monolith/express/sqlite', () => {
    expect.hasAssertions();
    const ids = GENERATION_MATRIX.map((cell: { id: string }) => cell.id);
    expect(ids).toStrictEqual(EXPECTED_CELL_IDS);
  });

  it('runs the matrix, records per-cell runtime, and names failing commands', () => {
    expect.hasAssertions();
    const logs: string[] = [];
    const report = runGenerationMatrix({
      packageRoot,
      log: (message: string) => {
        logs.push(message);
      }
    });

    // Keep the timed report in the assertion payload for CI logs.
    expect(formatMatrixReport(report)).toContain('monolith/express/sqlite');
    assertMatrixAcceptable(report);

    const required = report.results.find(
      (cell: { id: string }) => cell.id === 'monolith-express-sqlite'
    );
    expect(required).toMatchObject({
      id: 'monolith-express-sqlite',
      status: 'passed'
    });
    expect(logs.some((line) => line.includes('monolith/express/sqlite'))).toBe(true);
  });
});
