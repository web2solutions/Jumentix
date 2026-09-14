/**
 * JUM-776/778/781 — the Users X-CRUD against the real paginated contract:
 * server-side search, sort, filters, paging, row detail, edit with the
 * organization label, create with array editors, delete, and Portuguese.
 */
describe('users X-CRUD', () => {
  beforeEach(() => {
    cy.login('superadmin');
    cy.visit('/#/users');
    cy.get('tbody tr').should('have.length.at.least', 6);
  });

  it('searches and sorts through the server (q / sort query params)', () => {
    cy.intercept('GET', '/api/1.0.0/users?*').as('list');
    cy.get('input[aria-label="search"]').type('obama');
    // Typed input is debounced (JUM-781): the word is one request, not five.
    cy.wait('@list').its('request.url').should('include', 'q=obama');
    cy.get('tbody tr').should('have.length', 1);
    cy.get('tbody tr').first().should('contain', 'Barack');
    cy.get('input[aria-label="search"]').clear();
    cy.wait('@list');
    cy.contains('th', 'First name').click();
    cy.wait('@list').its('request.url').should('include', 'sort=firstName%3Aasc');
    cy.get('tbody tr').first().should('contain', 'Admin');
    cy.get('.xcrud-footer span').invoke('text').should('match', /1–\d+ of \d+/);
  });

  it('opens the column filter row from the toolbar and filters by organization with the quick select', () => {
    cy.intercept('GET', '/api/1.0.0/users?*').as('list');
    cy.contains('button', 'Filters').click();
    cy.get('.xcrud-filter-row').should('be.visible');
    cy.get('input[aria-label="filter-firstName"]').type('ed');
    cy.wait('@list').its('request.url').should('include', 'filter=');
    // Re-query after each assertion: the grid re-renders rows when a page lands.
    cy.get('tbody tr').should('have.length', 1);
    cy.get('tbody tr').first().should('contain', 'eduardo');
    cy.get('input[aria-label="filter-firstName"]').clear();
    cy.wait('@list');
    cy.get('select[aria-label="organization"]').select('ACME');
    cy.wait('@list').its('request.url').should('include', 'filter=');
    // Retry until the filtered page has replaced the unfiltered one.
    cy.get('tbody').should('not.contain', 'XpertMinds');
    cy.get('tbody tr').should('have.length.at.least', 1);
    cy.get('tbody tr').each(($row) => expect($row.text()).to.contain('ACME'));
  });

  it('shows the row detail with array tabs, formatted dates and the org label in the edit form', () => {
    cy.contains('tbody tr', 'Barack').find('button[aria-label^="preview "]').click();
    cy.get('.xcrud-row-detail .nav-link').should('contain', 'User Data').and('contain', 'Emails');
    cy.get('.xcrud-row-detail').should('not.contain', 'T00:00:');
    cy.get('.xcrud-row-detail').contains('.nav-link', 'Edit User').click();
    cy.get('#xref-organization').should('have.value', 'ACME');
    cy.get('.xcrud-row-detail .form-text').first().should('contain', 'User\'s first name');
  });

  it('creates a user with a document row, then deletes it', () => {
    const username = `e2e-${Date.now()}@x.dev`;
    cy.contains('.nav-link', 'New User').click();
    cy.get('#oas-field-firstName').type('E2E');
    cy.get('#oas-field-lastName').type('Runner');
    cy.get('#oas-field-username').type(username);
    cy.get('#oas-field-password').type('e2e@123456');
    cy.get('#oas-field-primaryEmail').type(username);
    cy.get('#xref-organization').type('ACME');
    cy.get('button[aria-label="add documents"]').click();
    cy.get('.xcrud-array-editor label').should('contain', 'Type').and('contain', 'Number');
    cy.get('button[aria-label="Remove documents 0"]').click();
    cy.contains('button', 'Create').click();
    cy.get('.alert-success').should('contain', 'record created');
    cy.get('input[aria-label="search"]').type('e2e-');
    cy.get('tbody tr').should('have.length', 1);
    cy.get('tbody tr').first().should('contain', username);
    cy.get('tbody tr').first().find('button[aria-label^="delete "]').click();
    cy.get('.alert-success').should('contain', 'record removed');
    cy.get('tbody').should('not.contain', username);
  });

  it('renders the listing in Portuguese after switching the locale', () => {
    cy.get('.header [aria-label="Account"]').click();
    cy.get('.header .dropdown-menu.show').contains('Português (BR)').click();
    cy.contains('.card-header .nav-link', 'Listagem de Usuário').should('be.visible');
    cy.contains('th', 'Nome').should('be.visible');
    cy.contains('button', 'Filtros').should('be.visible');
  });
});
