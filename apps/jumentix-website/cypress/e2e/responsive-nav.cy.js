describe('responsive navigation and overflow', () => {
  it('opens mobile navigation without horizontal overflow', () => {
    cy.viewport(390, 844);
    cy.visitQuiet('/');
    cy.assertNoHorizontalOverflow();

    cy.get('summary[aria-controls="jtx-mobile-navigation"]').click();
    cy.get('#jtx-mobile-navigation').should('be.visible');
    cy.get('#jtx-mobile-navigation a').first().should('be.visible');
    cy.assertNoHorizontalOverflow();
  });

  it('keeps the desktop main navigation visible', () => {
    cy.viewport(1280, 800);
    cy.visitQuiet('/product');
    cy.get('nav[aria-label="Main navigation"]').should('be.visible');
    cy.get('summary[aria-controls="jtx-mobile-navigation"]').should('not.be.visible');
    cy.assertNoHorizontalOverflow();
  });

  it('does not overflow documentation on a narrow viewport', () => {
    cy.viewport(390, 844);
    cy.visitQuiet('/docs/jumentix/guides/rest-api');
    cy.contains('Creating REST API with Jumentix').should('exist');
    cy.assertNoHorizontalOverflow();
  });
});
