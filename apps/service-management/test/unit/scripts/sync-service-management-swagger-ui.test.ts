/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for the SM swagger-ui sync script (JUM-818) — copies the
 * already-reviewed swagger-ui-dist files from the backend-template OASdoc
 * directory into the Service Management vendor tree.
 *
 * Everything external is injected (fs, logger) except the default-argument
 * case, which runs the real copy into the gitignored vendor directory.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  FILES,
  SOURCE_DIR,
  TARGET_DIR,
  syncServiceManagementSwaggerUi
} = require(path.join(repoRoot, 'apps/service-management/scripts/sync-service-management-swagger-ui.js'));

function createHarness(options: { missingFile?: string } = {}) {
  const { missingFile } = options;
  const logs: string[] = [];
  const errors: string[] = [];
  const written: Array<{ target: string; contents: string }> = [];
  const contents = new Map(FILES.map((file: string) => [file, `/* ${file} */\n`]));
  const harness = {
    root: '/repo',
    exists: (target: string) => {
      const rel = path.relative(path.join('/repo', SOURCE_DIR), target);
      return FILES.includes(rel) && path.basename(target) !== missingFile;
    },
    readFile: (target: string) => {
      const rel = path.relative(path.join('/repo', SOURCE_DIR), target);
      if (!contents.has(rel)) throw new Error(`unexpected read: ${target}`);
      return contents.get(rel);
    },
    writeFile: (target: string, contentsValue: string) => {
      written.push({ target, contents: contentsValue });
    },
    logger: {
      log: (line: string) => logs.push(String(line)),
      error: (line: string) => errors.push(String(line))
    }
  };
  return {
    harness, logs, errors, written
  };
}

describe('sync-service-management-swagger-ui (JUM-818)', () => {
  it('pins the source, target and file list', () => {
    expect.hasAssertions();
    expect(SOURCE_DIR).toBe(path.join('apps', 'backend-template', 'OASdoc'));
    expect(TARGET_DIR).toBe(path.join('apps', 'service-management', 'vendor', 'swagger-ui'));
    expect(FILES).toStrictEqual([
      'swagger-ui-bundle.js',
      'swagger-ui.css',
      'swagger-ui-standalone-preset.js'
    ]);
  });

  it('fails closed when a reviewed source file is missing', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ missingFile: 'swagger-ui.css' });
    expect(syncServiceManagementSwaggerUi(harness)).toBe(1);
    expect(errors.join('\n')).toContain('missing');
    // Files listed before the missing one were already copied; the failure is
    // reported, not rolled back.
    expect(written.map((entry) => path.basename(entry.target)))
      .toStrictEqual(['swagger-ui-bundle.js']);
  });

  it('copies every reviewed file from OASdoc into the vendor tree', () => {
    expect.hasAssertions();
    const { harness, logs, written } = createHarness();
    expect(syncServiceManagementSwaggerUi(harness)).toBe(0);
    expect(written.map((entry) => path.basename(entry.target)).sort())
      .toStrictEqual([...FILES].sort());
    expect(written[0].contents).toContain('swagger-ui-bundle.js');
    expect(logs.join('\n')).toContain('swagger-ui synced');
  });

  it('defaults to the process working directory when called without options', () => {
    expect.hasAssertions();
    const repoRootDir = path.resolve(repoRoot);
    expect(process.cwd()).toBe(repoRootDir);
    expect(syncServiceManagementSwaggerUi()).toBe(0);
    const fs = require('fs');
    FILES.forEach((file: string) => {
      expect(fs.existsSync(path.join(repoRootDir, TARGET_DIR, file))).toBe(true);
    });
  });
});
