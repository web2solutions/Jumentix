/**
 * JUM-806 — local-first writes stay visible as pending when the API is down.
 */
describe('offline writes', () => {
  it('keeps a created user locally while /api is failing', () => {
    cy.login('superadmin');
    cy.visit('/#/users');
    cy.get('.xcrud-grid tbody tr').should('have.length.at.least', 6);
    cy.goOffline();
    const username = `offline-${Date.now()}@x.dev`;
    cy.contains('.nav-link', 'New User').click();
    cy.get('#oas-field-firstName').type('Offline');
    cy.get('#oas-field-lastName').type('Row');
    cy.get('#oas-field-username').type(username);
    cy.get('#oas-field-password').type('e2e@123456');
    cy.get('#oas-field-primaryEmail').type(username);
    cy.contains('button', 'Create').click();
    cy.get('.xcrud-grid tbody tr').contains(username);
  });
});
