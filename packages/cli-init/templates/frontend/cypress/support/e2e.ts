import 'cypress-axe';

/**
 * Seeded accounts (apps/backend-template/seed/users.ts). The e2e backend
 * starts fresh (InMemory) on every run, so these always exist.
 */
export const accounts = {
  superadmin: { username: 'eduardo@xpertminds.dev', password: 'eduardo@123456' },
  admin: { username: 'admin@xpertminds.dev', password: 'admin@123456' },
  user: { username: 'user@xpertminds.dev', password: 'user@123456' }
};

const backendOrigin = `http://127.0.0.1:${Cypress.env('FRONTEND_E2E_BACKEND_PORT') || '3130'}`;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Signs in through the real login form and waits for the dashboard. */
      login(role: keyof typeof accounts): Chainable<void>;
      goOffline(): Chainable<void>;
      goOnline(): Chainable<void>;
      serverCreate(
        entity: 'users' | 'organizations',
        body: Record<string, unknown>
      ): Chainable<Cypress.Response<unknown>>;
    }
  }
}

Cypress.Commands.add('login', (role) => {
  const account = accounts[role];
  cy.visit('/#/login');
  cy.window().then((win) => {
    const wipe = (win as Window & { __jumentixWipeCana?: () => Promise<void> }).__jumentixWipeCana;
    if (wipe) return wipe();
    return undefined;
  });
  cy.get('#oas-field-username').clear().type(account.username);
  cy.get('#oas-field-password').clear().type(account.password);
  cy.get('form').submit();
  cy.location('hash', { timeout: 30000 }).should('eq', '#/m/users/dashboard');
});

Cypress.Commands.add('goOffline', () => {
  cy.intercept({ url: '/api/**' }, { forceNetworkError: true }).as('offlineApi');
});

Cypress.Commands.add('goOnline', () => {
  cy.intercept({ url: '/api/**' }, (req) => req.continue()).as('onlineApi');
});

Cypress.Commands.add('serverCreate', (entity, body) => {
  cy.request('POST', `${backendOrigin}/1.0.0/${entity}`, body);
});

beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.clear();
    win.sessionStorage.clear();
    win.localStorage.setItem('jumentix-frontend-locale', 'en');
  });
});
