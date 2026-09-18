/**
 * JUM-811/812/813 — dashboard totals and domain widgets vs the metrics contract.
 */
const backendOrigin = `http://127.0.0.1:${Cypress.env('FRONTEND_E2E_BACKEND_PORT') || '3130'}`;

describe('organizations, dashboard and profile', () => {
  it('lists organizations with member usernames and totals on the dashboard', () => {
    cy.login('superadmin');
    cy.window().then((win) => {
      const raw = win.localStorage.getItem('jumentix-frontend-auth');
      expect(raw).to.be.a('string');
      const { token } = JSON.parse(raw as string) as { token: string };
      cy.request({
        url: `${backendOrigin}/api/1.0.0/users/metrics?metric=count`,
        headers: { Authorization: token }
      }).then((usersMetrics) => {
        const usersTotal = usersMetrics.body.buckets[0].count as number;
        cy.get('[data-metric="users"]').should('contain', String(usersTotal));
      });
      cy.request({
        url: `${backendOrigin}/api/1.0.0/organizations/metrics?metric=count`,
        headers: { Authorization: token }
      }).then((orgMetrics) => {
        const orgTotal = orgMetrics.body.buckets[0].count as number;
        cy.get('[data-metric="organizations"]').should('contain', String(orgTotal));
      });
    });
    cy.get('[data-widget="users:admin-user-ratio"]').should('contain', '/');
    cy.get('[data-widget="users:members-per-org"]').should('exist');
    cy.get('[data-metric="signups-30d"]').should('exist');
    cy.get('body').should('not.contain', 'Traffic');
    cy.visit('/#/organizations');
    cy.contains('.xcrud-grid tbody tr', 'ACME').should('contain', 'user2');
    cy.contains('.xcrud-grid tbody tr', 'ACME').invoke('text').should('not.match', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/);
    cy.contains('.xcrud-grid tbody tr', 'ACME').find('button[aria-label^="preview "]').click();
    cy.get('.xcrud-row-detail').should('contain', 'user2');
  });

  it('updates the profile scalars and lists sub-resources with contract labels', () => {
    cy.login('admin');
    cy.get('.header [aria-label="Account"]').click();
    cy.contains('.dropdown-item', 'Profile').click();
    cy.location('hash').should('eq', '#/profile');
    cy.get('h2').should('contain', 'My profile');
    cy.get('table').first().find('th').first()
      .should('contain', 'Email');
    cy.get('#oas-field-lastName').clear().type('XpertMinds');
    cy.contains('button', 'Save profile').click();
    cy.get('.alert-success').should('contain', 'Profile saved');
  });

  it('drops the session and returns to /login when the token is no longer accepted', () => {
    cy.login('user');
    cy.window().then((win) => {
      const raw = win.localStorage.getItem('jumentix-frontend-auth')!;
      const parsed = JSON.parse(raw);
      parsed.token = 'Bearer invalid.token.value';
      win.localStorage.setItem('jumentix-frontend-auth', JSON.stringify(parsed));
    });
    cy.visit('/#/profile');
    cy.reload();
    cy.location('hash').should('eq', '#/login');
  });
});
