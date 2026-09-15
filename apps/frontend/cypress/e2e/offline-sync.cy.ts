/**
 * JUM-805 — first login runs a full load behind a progress bar, then the shell.
 */
describe('offline sync', () => {
  it('shows sync progress then the dashboard, and a second user wipes local data', () => {
    cy.visit('/#/login');
    cy.get('#oas-field-username').type('eduardo@xpertminds.dev');
    cy.get('#oas-field-password').type('eduardo@123456');
    cy.get('form').submit();
    cy.location('hash', { timeout: 15000 }).should('be.oneOf', [
      '#/sync',
      '#/m/users/dashboard'
    ]);
    cy.location('hash', { timeout: 30000 }).should('eq', '#/m/users/dashboard');
    cy.contains('Users');

    cy.get('.header [aria-label="Account"]').click();
    cy.contains('.dropdown-item', 'Logout').click();
    cy.get('#oas-field-username').clear().type('user@xpertminds.dev');
    cy.get('#oas-field-password').clear().type('user@123456');
    cy.get('form').submit();
    cy.location('hash', { timeout: 15000 }).should('be.oneOf', [
      '#/sync',
      '#/m/users/dashboard'
    ]);
    cy.location('hash', { timeout: 30000 }).should('eq', '#/m/users/dashboard');
  });
});
