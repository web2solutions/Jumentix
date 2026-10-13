/* eslint-disable jest/prefer-expect-assertions */
import path from 'path';

import {
  FILES,
  SOURCE_DIR,
  TARGET_DIR,
  syncServiceManagementJumentixUi
} from '../../../scripts/sync-service-management-jumentix-ui.js';

describe('sync-service-management-jumentix-ui', () => {
  it('copies the three CSS files into the SPA vendor tree', () => {
    expect.hasAssertions();
    const written: Array<{ target: string; contents: string }> = [];
    const sourceRoot = path.join('root', SOURCE_DIR);
    const files = new Map<string, string>([
      [path.join(sourceRoot, 'jumentix-ui.css'), '@import \'./tokens.css\';\n'],
      [path.join(sourceRoot, 'tokens.css'), ':root{}\n'],
      [path.join(sourceRoot, 'primitives.css'), '.jx-btn{}\n']
    ]);
    const existing = new Set<string>([...files.keys(), sourceRoot]);
    const code = syncServiceManagementJumentixUi({
      root: 'root',
      exists: (target: string) => existing.has(target),
      readFile: (target: string) => files.get(target) as string,
      writeFile: (target: string, contents: string | Buffer) => {
        written.push({ target, contents: String(contents) });
      },
      removeDir: () => {},
      logger: { log() {}, error() {} }
    });
    expect(code).toBe(0);
    expect(FILES).toStrictEqual(['jumentix-ui.css', 'tokens.css', 'primitives.css']);
    expect(TARGET_DIR).toBe(path.join('apps', 'service-management', 'vendor', 'jumentix-ui'));
    expect(written.map((entry) => entry.target)).toStrictEqual(
      FILES.map((file) => path.join('root', TARGET_DIR, file))
    );
  });

  it('fails closed when the package CSS directory is missing', () => {
    expect.hasAssertions();
    const errors: string[] = [];
    const code = syncServiceManagementJumentixUi({
      root: 'root',
      exists: () => false,
      logger: { log() {}, error: (message: string) => { errors.push(message); } }
    });
    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('package CSS not found');
  });
});
