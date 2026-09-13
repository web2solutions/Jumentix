/**
 * Seeded accounts (apps/backend-template/seed/users.ts). The e2e backend
 * starts fresh (InMemory) on every run, so these always exist.
 */
export const accounts = {
  superadmin: { username: 'eduardo@xpertminds.dev', password: 'eduardo@123456' },
  admin: { username: 'admin@xpertminds.dev', password: 'admin@123456' },
  user: { username: 'user@xpertminds.dev', password: 'user@123456' }
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Signs in through the real login form and waits for the dashboard. */
      login(role: keyof typeof accounts): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (role) => {
  const account = accounts[role];
  cy.visit('/#/login');
  cy.reload(); // hash-only visits do not reload; start every login from a fresh SPA state
  cy.get('#oas-field-username').clear().type(account.username);
  cy.get('#oas-field-password').clear().type(account.password);
  cy.get('form').submit();
  cy.location('hash').should('eq', '#/dashboard');
});

beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.clear();
    win.localStorage.setItem('jumentix-frontend-locale', 'en');
  });
});
