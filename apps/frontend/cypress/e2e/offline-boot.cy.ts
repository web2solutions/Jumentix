/**
 * JUM-802 — Cana opens before the login form, with users and organizations stores.
 */
describe('offline boot', () => {
  it('opens IndexedDB tables before login', () => {
    cy.visit('/#/login');
    cy.get('#oas-field-username');
    cy.window().then(async (win) => {
      const dbs = await win.indexedDB.databases();
      expect(dbs.map((item) => item.name)).to.include('jumentix-frontend');
      const stores = (win as Window & { __jumentixObjectStores?: () => string[] })
        .__jumentixObjectStores?.() ?? [];
      expect(stores).to.include.members(['users', 'organizations', 'meta', 'outbox']);
    });
  });
});
