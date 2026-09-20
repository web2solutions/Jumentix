/**
 * JUM-799/800 — shell layout facts at phone, tablet and desktop viewports.
 */
describe('responsive shell', () => {
  const assertNoPageScroll = () => {
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.at.most(doc.defaultView!.innerWidth);
    });
  };

  it('uses a compact taskbar and overflow widgets at 375×812', () => {
    cy.viewport(375, 812);
    cy.login('superadmin');
    cy.get('[data-shell-bp]').should('have.attr', 'data-shell-bp', 'xs');
    cy.get('[data-taskbar]').should('have.attr', 'data-sheet', 'true');
    cy.get('[data-widget-overflow]').should('exist');
    assertNoPageScroll();
  });

  it('keeps a compact taskbar at 768×1024', () => {
    cy.viewport(768, 1024);
    cy.login('superadmin');
    cy.get('[data-shell-bp]').should('have.attr', 'data-shell-bp', 'md');
    cy.get('[data-taskbar]').should('have.attr', 'data-compact', 'false');
    assertNoPageScroll();
  });

  it('shows labelled task buttons at 1280×800', () => {
    cy.viewport(1280, 800);
    cy.login('superadmin');
    cy.get('[data-shell-bp]').should('have.attr', 'data-shell-bp', 'xl');
    cy.get('[data-taskbar]').should('have.attr', 'data-compact', 'false');
    cy.get('.app-taskbar__label').should('contain', 'Users');
    assertNoPageScroll();
  });
});
