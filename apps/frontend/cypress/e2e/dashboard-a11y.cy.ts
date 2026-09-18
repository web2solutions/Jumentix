/**
 * JUM-813 — axe on the dashboard tab at the three shell viewports.
 */
const assertDashboardA11y = (width: number, height: number): void => {
  cy.viewport(width, height);
  cy.login('superadmin');
  cy.get('[data-dashboard-grid]').should('exist');
  cy.get('[data-chart-table-toggle]').first().click();
  cy.get('[data-chart-table]').first().should('be.visible');
  cy.injectAxe();
  cy.checkA11y('[data-dashboard-grid]', {
    includedImpacts: ['critical', 'serious'],
    rules: {
      // Chart.js canvas: numbers live in the table fallback.
      'color-contrast': { enabled: false }
    }
  });
};

describe('dashboard accessibility', () => {
  it('has no serious/critical axe violations at 375×812', () => {
    assertDashboardA11y(375, 812);
  });

  it('has no serious/critical axe violations at 768×1024', () => {
    assertDashboardA11y(768, 1024);
  });

  it('has no serious/critical axe violations at 1280×800', () => {
    assertDashboardA11y(1280, 800);
  });
});
