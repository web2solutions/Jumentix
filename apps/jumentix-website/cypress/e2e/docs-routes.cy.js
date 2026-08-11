const documentationRoutes = [
  ['/docs/jumentix', ['Build with Jumentix', 'Jumentix Docs']],
  ['/docs/overview', ['Jumentix Overview', 'Jumentix Docs']],
  ['/docs/jumentix/guides/realtime-api', ['Creating Realtime API with Jumentix']],
  ['/docs/realtime-api-guide', ['Creating Realtime API with Jumentix']],
  ['/docs/jumentix/concepts', ['Concepts']],
  ['/docs/jumentix/concepts/architecture', ['Hexagonal Architecture']],
  ['/docs/jumentix/guides', ['Guides']],
  ['/docs/jumentix/guides/rest-api', ['Creating REST API with Jumentix']],
  ['/docs/jumentix/adapters', ['Adapters']],
  ['/docs/jumentix/adapters/http/express', ['Express']],
  ['/docs/jumentix/adapters/databases/mongodb', ['MongoDB']],
  ['/docs/jumentix/packages/message-mediator', ['@jumentix/message-mediator']],
  ['/docs/jumentix/packages/cana', ['@jumentix/cana', 'Try it in the browser']],
  ['/docs/jumentix/packages/cana/usage', ['Cana usage guide', 'Interactive playgrounds']],
  ['/docs/jumentix/reference/runtime-contracts', ['Runtime']],
  ['/docs/pt-BR/jumentix', ['Construa com o Jumentix']],
  ['/docs/pt-BR/jumentix/concepts', ['Conceitos']],
  ['/docs/pt-BR/jumentix/guides/rest-api', ['Criando API REST com Jumentix']],
  ['/docs/pt-BR/jumentix/adapters', ['Adaptadores']],
  ['/docs/pt-BR/jumentix/adapters/http/express', ['Express']],
  ['/docs/pt-BR/jumentix/packages/message-mediator', ['@jumentix/message-mediator']],
  ['/docs/pt-BR/jumentix/packages/cana', ['@jumentix/cana']],
  ['/docs/pt-BR/jumentix/packages/cana/usage', ['Guia de uso do Cana', 'Playgrounds interativos']]
];

describe('Cana playground', () => {
  it('runs and resets the getting-started playground', () => {
    cy.visitQuiet('/docs/jumentix/packages/cana');
    cy.get('[data-testid="cana-playground-getting-started"]').should('exist');
    cy.get('[data-testid="cana-playground-run-getting-started"]').click();
    cy.get('[data-testid="cana-playground-output-getting-started"]', { timeout: 15000 })
      .should('exist')
      .and('contain.text', 'backend');
    cy.get('[data-testid="cana-playground-reset-getting-started"]').click();
    cy.get('[data-testid="cana-playground-output-getting-started"]').should('not.exist');
  });
});


describe('documentation routes and compatibility redirects', () => {
  for (const [path, includes] of documentationRoutes) {
    it(`renders ${path}`, () => {
      cy.visitQuiet(path);
      for (const fragment of includes) {
        cy.contains(fragment, { matchCase: false }).should('exist');
      }
    });
  }

  it('keeps internal doc links resolvable from the docs hub', () => {
    cy.visitQuiet('/docs/jumentix');
    cy.get('a[href^="/docs/"]').then(($links) => {
      const hrefs = [...new Set(
        [...$links].map((el) => el.getAttribute('href')).filter(Boolean)
      )].slice(0, 12);

      expect(hrefs.length, 'docs hub should expose internal links').to.be.greaterThan(0);

      for (const href of hrefs) {
        cy.request({ url: href, failOnStatusCode: true }).its('status')
          .should('be.lt', 400);
      }
    });
  });
});
