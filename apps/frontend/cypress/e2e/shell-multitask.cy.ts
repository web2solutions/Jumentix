/**
 * JUM-796/800 — multitask shell against the real backend: one task per
 * module, keep-alive across switches, reload restores the taskbar.
 */
describe('multitask shell', () => {
  it('keeps an open Users edit after visiting the dashboard tab and restores tasks on reload', () => {
    cy.login('superadmin');
    cy.visit('/#/users');
    cy.get('tbody tr').should('have.length.at.least', 6);
    cy.contains('tbody tr', 'Barack').find('button[aria-label^="preview "]').click();
    cy.get('.xcrud-row-detail').should('be.visible');
    cy.contains('[data-module-tabs] .nav-link', 'Dashboard').click();
    cy.get('[data-metric="users"]').should('be.visible');
    cy.contains('[data-module-tabs] .nav-link', 'Users').click();
    cy.get('.xcrud-row-detail').should('be.visible').and('contain', 'Barack');
    cy.get('[data-taskbar] [data-active="true"]').should('contain', 'Users');
    cy.reload();
    cy.get('[data-taskbar] [data-active="true"]').should('contain', 'Users');
    cy.location('hash').should('include', '/m/users');
  });
});
