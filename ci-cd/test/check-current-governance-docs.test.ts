/* eslint-disable @typescript-eslint/no-var-requires */
const { missingLanguageTwins } = require('../check-current-governance-docs.js');

/**
 * Requirement 076 pairs every contributor document with a Portuguese twin.
 * The negative control is the state JUM-895 found: English-only evidence
 * records under documentation/md that no check reported.
 */
describe('documentation language twins (JUM-895)', () => {
  it('reports an English document without its Portuguese twin', () => {
    expect.hasAssertions();

    expect(missingLanguageTwins(['documentation/md/BUN-BRANCH-COVERAGE-SPIKE.md'])).toStrictEqual([
      'documentation/md/BUN-BRANCH-COVERAGE-SPIKE.md: missing Portuguese counterpart '
        + 'documentation/md/BUN-BRANCH-COVERAGE-SPIKE.pt-BR.md (Requirement 076)'
    ]);
  });

  it('reports a Portuguese document without its English twin', () => {
    expect.hasAssertions();

    expect(missingLanguageTwins(['documentation/md/guides/X.pt-BR.md'])).toStrictEqual([
      'documentation/md/guides/X.pt-BR.md: missing English counterpart documentation/md/guides/X.md (Requirement 076)'
    ]);
  });

  it('accepts complete pairs and ignores files outside documentation/md', () => {
    expect.hasAssertions();

    expect(missingLanguageTwins([
      'documentation/md/A.md',
      'documentation/md/A.pt-BR.md',
      'README.md',
      'apps/x/README.md'
    ])).toStrictEqual([]);
  });
});
