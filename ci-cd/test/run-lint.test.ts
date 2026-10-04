import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { runLintSurface } = require('../run-lint.js');

/**
 * JUM-19 — the lint runner is only trusted to pass because it is proven to
 * fail. Each fixture is a throwaway tree outside the repository with its own
 * self-contained eslint.config.mjs.
 */
describe('run-lint runner (Requirement 138 §4)', () => {
  const trees: string[] = [];

  function makeTree(files: Record<string, string>, configRules = "'no-console': 'error'"): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'run-lint-'));
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    // eslint.config.ts is loaded by eslint's jiti but matches no fixture
    // glob (src/**/*.js), so it never inflates the discovered file count.
    writeFileSync(
      path.join(dir, 'eslint.config.ts'),
      `export default [{ files: ['src/**/*.js'], rules: { ${configRules} } }];\n`
    );
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(path.join(dir, 'src', name), contents);
    }
    trees.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const dir of trees) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits non-zero on a negative fixture (a known violation)', () => {
    expect.assertions(2);
    const dir = makeTree({ 'bad.js': "console.log('x');\n" });
    const result = runLintSurface('root', { cwd: dir, floor: 1 });
    expect(result.code).not.toBe(0);
    expect(result.errors).toBe(1);
  });

  it('exits non-zero when file discovery matches nothing (empty glob)', () => {
    expect.assertions(2);
    const dir = mkdtempSync(path.join(tmpdir(), 'run-lint-empty-'));
    writeFileSync(
      path.join(dir, 'eslint.config.ts'),
      "export default [{ files: ['src/**/*.js'], rules: {} }];\n"
    );
    trees.push(dir);
    const result = runLintSurface('root', { cwd: dir });
    expect(result.code).toBe(2);
    expect(result.files).toBe(0);
  });

  it('exits non-zero when coverage shrinks below the recorded floor', () => {
    expect.assertions(1);
    const dir = makeTree({ 'ok.js': 'export const ok = 1;\n' });
    const result = runLintSurface('root', { cwd: dir, floor: 9999 });
    expect(result.code).toBe(2);
  });

  it('passes a clean fixture and reports the file count', () => {
    expect.assertions(3);
    const dir = makeTree({
      'ok.js': 'export const ok = 1;\n',
      'ok2.js': 'export const ok2 = 2;\n'
    });
    const result = runLintSurface('root', { cwd: dir, floor: 2 });
    expect(result.code).toBe(0);
    expect(result.files).toBe(2);
    expect(result.errors).toBe(0);
  });

  it('fails closed on an unknown surface', () => {
    expect.assertions(1);
    expect(runLintSurface('no-such-surface').code).toBe(2);
  });
});
