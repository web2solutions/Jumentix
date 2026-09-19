/**
 * JUM-808 — listings survive a failed /api after the first sync (Vite dest
 * does not register the service worker unless VITE_PWA=1).
 */
describe('offline listings after sync', () => {
  it('still lists users when GET /api/users fails', () => {
    cy.login('superadmin');
    cy.visit('/#/users');
    cy.get('.xcrud-grid tbody tr').should('have.length.at.least', 6);
    cy.intercept('GET', '/api/1.0.0/users?*', { forceNetworkError: true });
    cy.get('input[aria-label="search"]').type('obama');
    cy.get('.xcrud-grid tbody tr').should('have.length', 1);
    cy.get('.xcrud-grid tbody tr').first().should('contain', 'Barack');
  });
});
