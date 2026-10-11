/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const { JUMENTIX_UI_PREFIX, JUMENTIX_UI_VERSION } = require('../../src/index.js');

describe('@jumentix/jumentix-ui package surface', () => {
  it('exports prefix and version', () => {
    expect.hasAssertions();
    expect(JUMENTIX_UI_PREFIX).toBe('jtx-ui');
    expect(JUMENTIX_UI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('ships tokens, primitives, entry CSS and gallery', () => {
    expect.hasAssertions();
    const root = join(__dirname, '../..');
    const requiredPaths = [
      'src/css/tokens.css',
      'src/css/primitives.css',
      'src/css/jumentix-ui.css',
      'gallery/index.html'
    ];
    expect(requiredPaths.every((rel) => existsSync(join(root, rel)))).toBe(true);
    const css = readFileSync(join(root, 'src/css/primitives.css'), 'utf8');
    const markers = ['.jtx-ui-toolbar', '.jtx-ui-scope-chrome', '.jtx-ui-tabs', '.jtx-ui-form'];
    expect(markers.every((marker) => css.includes(marker))).toBe(true);
  });

  it('documents EN and PT', () => {
    expect.hasAssertions();
    const root = join(__dirname, '../..');
    expect(existsSync(join(root, 'README.md'))).toBe(true);
    expect(existsSync(join(root, 'README.pt-BR.md'))).toBe(true);
  });
});
