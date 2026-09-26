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
    const canvas = ruleBody('.architecture-shell .architecture-canvas');

    expect(canvas).toContain('background-color: #070707;');
    expect(canvas).not.toContain('--jtx-surface');
  });

  it('keeps the sidebar dark', () => {
    expect.hasAssertions();

    expect(ruleBody('.architecture-shell .sidebar')).toContain('background: rgba(18, 19, 23, 0.97);');
  });

  it('overlays the mini-map on a positioned workspace instead of stacking it below', () => {
    expect.hasAssertions();

    expect(ruleBody('.architecture-mini-map')).not.toContain('position: relative');
    expect(ruleBody('.architecture-shell .canvas-workspace')).toContain('position: relative;');
  });
});
