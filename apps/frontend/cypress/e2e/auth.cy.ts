import { accounts } from '../support/e2e';

/**
 * JUM-776 — authentication against the real backend: login, RBAC-driven
 * navigation per role, unauthenticated redirect, logout.
 */
describe('authentication', () => {
  it('redirects an unauthenticated visitor to /login and shows the OAS-driven form', () => {
    cy.visit('/#/users');
    cy.location('hash').should('eq', '#/login');
    cy.get('label[for="oas-field-username"]').should('contain', 'Username');
    cy.get('#oas-field-schemaType').should('not.exist');
  });

  it('shows the contract error for wrong credentials without leaving the page', () => {
    cy.visit('/#/login');
    cy.get('#oas-field-username').type(accounts.user.username);
    cy.get('#oas-field-password').type('wrong-password');
    cy.get('form').submit();
    cy.get('[role="alert"]').should('be.visible');
    cy.location('hash').should('eq', '#/login');
  });

  it('signs in each seeded role and the sidebar reflects its scopes', () => {
    cy.login('superadmin');
    cy.get('.sidebar-nav').should('contain', 'Users').and('contain', 'Organizations');

    cy.login('admin');
    cy.get('.sidebar-nav').should('contain', 'Users').and('contain', 'Organizations');

    cy.login('user');
    cy.get('.sidebar-nav').should('contain', 'Users').and('not.contain', 'Organizations');
    cy.visit('/#/organizations');
    cy.location('hash').should('eq', '#/dashboard');
  });

  it('logs out from the account menu and lands on /login', () => {
    cy.login('user');
    cy.get('.header [aria-label="Account"]').click();
    cy.contains('.dropdown-item', 'Logout').click();
    cy.location('hash').should('eq', '#/login');
  });
});
