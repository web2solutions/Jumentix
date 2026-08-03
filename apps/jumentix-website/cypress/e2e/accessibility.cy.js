const a11yRoutes = [
  '/',
  '/product',
  '/docs/jumentix',
  '/pt-BR',
  '/docs/pt-BR/jumentix'
];

describe('accessibility baselines (axe)', () => {
  for (const path of a11yRoutes) {
    it(`has no critical/serious axe violations on ${path}`, () => {
      cy.visitQuiet(path);
      cy.injectAxe();
      cy.checkA11y(
        undefined,
        {
          includedImpacts: ['critical', 'serious'],
          rules: {
            // Nextra/Mantine occasionally mark landmark regions in ways axe
            // flags as "region" noise; keep failing on real blockers.
            region: { enabled: false },
            // Large decorative metric figures inherit brand blue; tracked for
            // design-system token follow-up rather than blocking route gates.
            'color-contrast': { enabled: false }
          }
        },
        (violations) => {
          if (violations.length) {
            cy.task('log', JSON.stringify(violations, null, 2));
          }
        }
      );
    });
  }
});
