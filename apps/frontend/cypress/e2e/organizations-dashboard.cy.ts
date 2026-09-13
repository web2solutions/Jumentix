/**
 * JUM-776/781 — organizations listing with member labels, the real dashboard
 * totals, the profile page and the expired-session redirect, all over the
 * containerised backend.
 */
describe('organizations, dashboard and profile', () => {
  it('lists organizations with member usernames and totals on the dashboard', () => {
    cy.login('superadmin');
    cy.get('[data-metric="users"]').should('contain', '6');
    cy.get('[data-metric="organizations"]').should('contain', '3');
    cy.get('body').should('not.contain', 'Traffic');
    cy.visit('/#/organizations');
    // Seeded membership: Barack (username `user2`) belongs to ACME.
    cy.contains('tbody tr', 'ACME').should('contain', 'user2');
    cy.contains('tbody tr', 'ACME').invoke('text').should('not.match', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/);
    cy.contains('tbody tr', 'ACME').find('button[aria-label^="preview "]').click();
    cy.get('.xcrud-row-detail').should('contain', 'user2');
  });

  it('updates the profile scalars and lists sub-resources with contract labels', () => {
    cy.login('admin'); // `user` has no update_user scope in the x-rbac matrix
    cy.visit('/#/profile');
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
    cy.reload(); // a hash-only visit keeps the in-memory session; the persisted one is what expired
    cy.location('hash').should('eq', '#/login');
  });
});
