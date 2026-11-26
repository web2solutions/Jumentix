/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * JUM-905: the designer is dark by its own palette and never sets `:root.dark`,
 * so `--jtx-surface` resolves to `#ffffff`. The Architecture tab used that
 * token for its canvas and sidebar and rendered a white field behind dark
 * service cards; its mini-map was forced to `position: relative` and fell
 * below the canvas as a white strip. These rules pin the dark surfaces and the
 * overlay placement.
 */
const styles = fs.readFileSync(path.resolve(__dirname, '../../styles.css'), 'utf-8');

function ruleBody(selector: string): string {
  const start = styles.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return styles.slice(start, styles.indexOf('}', start));
}

describe('architecture tab surfaces (JUM-905)', () => {
  it('paints the canvas with the Domain Designer surface, not the light token', () => {
    expect.hasAssertions();
    const canvas = ruleBody('#tab-architecture .architecture-canvas');

    expect(canvas).toContain('background-color: var(--jx-surface-canvas, #070707);');
    expect(canvas).not.toContain('--jtx-surface)');
  });

  it('keeps the sidebar dark', () => {
    expect.hasAssertions();

    expect(ruleBody('#tab-architecture .sidebar')).toContain('background: var(--jx-surface);');
  });

  it('overlays the mini-map on a positioned workspace instead of stacking it below', () => {
    expect.hasAssertions();

    expect(ruleBody('.architecture-mini-map')).not.toContain('position: relative');
    expect(ruleBody('#tab-architecture .workspace')).toContain('position: relative;');
  });

  it('keeps a canvas floor beside an elastic right rail', () => {
    expect.hasAssertions();

    expect(styles).toContain('--jx-canvas-min: 360px');
    expect(styles).toContain(
      'grid-template-columns: minmax(var(--jx-canvas-min), 1fr) minmax(0, var(--jx-rail-width))'
    );
    expect(styles).toContain('--jx-rail-width: clamp(280px, 24vw, 420px)');
    expect(styles).toContain('#tab-architecture .workspace-header');
    expect(styles).toContain('grid-template-rows: 42px minmax(0, 1fr)');
  });

  it('keeps main-nav destinations visible when labels collapse', () => {
    expect.hasAssertions();
    const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf-8');

    expect(html).toContain('class="tab-btn-icon"');
    expect(html).not.toContain('id="main-nav-current"');
    expect(styles).toContain('[data-main-nav="closed"] .tab-btn-label');
    expect(styles).toContain('.main-nav .control-help-btn');
    expect(styles).toContain('#tab-architecture #architecture-sidebar .control-help-btn');
    expect(styles).not.toMatch(
      /\[data-main-nav="closed"\][^{]*\.tab-nav\s*\{[^}]*display:\s*none/u
    );
  });
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { architectureLinkGeometry, architectureLinkLabel } = require('../../src/ui/architectureCanvas.js');

describe('architecture links (JUM-905)', () => {
  const core = {
    id: 'core', name: 'Core', x: 80, y: 80, width: 270, height: 190
  };
  const tasks = {
    id: 'service-import-2', name: 'Tasks API', x: 390, y: 80, width: 270, height: 190
  };

  it('joins facing card edges at mid-height instead of crossing the titles', () => {
    expect.hasAssertions();

    expect(architectureLinkGeometry(core, tasks)).toStrictEqual({
      x1: 350, y1: 175, x2: 390, y2: 175
    });
    expect(architectureLinkGeometry(tasks, core)).toStrictEqual({
      x1: 350, y1: 175, x2: 390, y2: 175
    });
  });

  it('labels links with service names, not internal ids', () => {
    expect.hasAssertions();

    expect(architectureLinkLabel({ from: 'core', to: 'service-import-2', protocol: 'rest' }, [core, tasks]))
      .toBe('Core —rest→ Tasks API');
  });
});
