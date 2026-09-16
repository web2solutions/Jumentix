/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'fs';
import path from 'path';

import { staticHelpIds } from '../../src/ui/controlHelp.js';

const appRoot = path.resolve(process.cwd(), 'apps/service-management');

function staticControlIds(html: string): Array<{ id: string; tag: string; markup: string }> {
  return Array.from(
    html.matchAll(/<(button|input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g),
    (match) => ({ tag: match[1], id: match[2], markup: match[0] })
  );
}

function hasVisibleButtonText(html: string, id: string): boolean {
  return new RegExp(`<button[^>]*id="${id}"[^>]*>\\s*[^<\\s]`, 'u').test(html);
}

function missingStaticControlHelp(html: string): string[] {
  const exempt = new Set(['import-json-input', 'import-oas-input', 'import-package-input']);
  const staticIds = new Set(staticHelpIds());
  return staticControlIds(html)
    .filter(({ id }) => !exempt.has(id))
    .filter(({ id, tag, markup }) => {
      const hasSemanticFallback = /aria-label=|aria-labelledby=|title=|placeholder=/.test(markup)
        || (tag === 'button' && hasVisibleButtonText(html, id));
      return !staticIds.has(id) && !hasSemanticFallback;
    })
    .map(({ id }) => id);
}

describe('service-management control help coverage (JUM-733)', () => {
  it('gives every static control a help affordance source, except hidden file inputs', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf-8');
    expect(missingStaticControlHelp(html)).toStrictEqual([]);
  });

  it('is loaded by the app shell and the offline service worker', () => {
    expect.hasAssertions();
    const script = fs.readFileSync(path.join(appRoot, 'script.js'), 'utf-8');
    const worker = fs.readFileSync(path.join(appRoot, 'sw.js'), 'utf-8');
    expect(script).toContain('./src/ui/controlHelp.js');
    expect(script).toContain('installControlHelp(document)');
    expect(worker).toContain('./src/ui/controlHelp.js');
  });

  it('keeps visual help out of tablists, dense rows and hidden editor hosts', () => {
    expect.hasAssertions();
    const source = fs.readFileSync(path.join(appRoot, 'src/ui/controlHelp.js'), 'utf-8');
    expect(source).toContain('VISUAL_HELP_HOST_BLOCKLIST');
    expect(source).toContain('\'.row, [role="tablist"], .code-editor-body, .entity, .mini-map, .canvas-context-menu\'');
    expect(source).toContain('control.id === \'code-workspace-editor\'');
    expect(source).toContain('ensureDescription(control, help, rootDocument)');
    expect(source).toContain('if (!shouldInstallVisualHelp(control)) return');
  });

  it('uses a document-level popover instead of nesting tooltip content in controls', () => {
    expect.hasAssertions();
    const source = fs.readFileSync(path.join(appRoot, 'src/ui/controlHelp.js'), 'utf-8');
    const styles = fs.readFileSync(path.join(appRoot, 'styles.css'), 'utf-8');
    expect(source).toContain('popover.id = \'control-help-popover\'');
    expect(source).toContain('rootDocument.body.appendChild(popover)');
    expect(source).toContain('button.setAttribute(\'aria-controls\', \'control-help-popover\')');
    expect(source).toContain('description.className = \'control-help-description\'');
    expect(styles).toContain('.control-help-description');
    expect(styles).toContain('position: fixed;');
  });
});
