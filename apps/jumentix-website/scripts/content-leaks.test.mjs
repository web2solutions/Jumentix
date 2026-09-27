import { stripMaintainerProvenance } from './content-leaks.mjs';

/**
 * JUM-895: contributor docs cite Linear issues and requirement numbers as
 * provenance; the developer site republishes them. The sync strips
 * provenance-only parentheticals and keeps everything that carries meaning.
 */
describe('stripMaintainerProvenance', () => {
  test('removes parentheticals that only cite issues, requirements or PRs', () => {
    expect.hasAssertions();
    const input = [
      'The store port (JUM-468) is async.',
      'Exports stay stable ([JUM-493]).',
      'See the matrix (Requirement `059`).',
      'Landed as designed (landed by JUM-460, merged in PR #86).',
      'Two epics (JUM-468/JUM-469) split the core.',
      'Linked ([JUM-479](https://linear.app/jumentix/issue/JUM-479/x)).'
    ].join('\n');

    expect(stripMaintainerProvenance(input)).toBe([
      'The store port is async.',
      'Exports stay stable.',
      'See the matrix.',
      'Landed as designed.',
      'Two epics split the core.',
      'Linked.'
    ].join('\n'));
  });

  test('keeps parentheticals that carry meaning', () => {
    expect.hasAssertions();
    const input = 'Bind to 127.0.0.1 (default port 3200) and export (see JUM-12 for history, it explains the migration).';

    expect(stripMaintainerProvenance(input)).toBe(input);
  });

  test('drops Linear link reference definitions', () => {
    expect.hasAssertions();

    expect(stripMaintainerProvenance('Text.\n[JUM-492]: https://linear.app/jumentix/issue/JUM-492\nMore.'))
      .toBe('Text.\nMore.');
  });

  test('leaves inline prose citations for the audience gate to report', () => {
    expect.hasAssertions();
    const input = 'The form validates against the Requirement `059` deploy matrix.';

    expect(stripMaintainerProvenance(input)).toBe(input);
  });
});
