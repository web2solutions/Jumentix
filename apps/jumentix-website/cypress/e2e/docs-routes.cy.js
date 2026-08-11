const documentationRoutes = [
  ['/docs/jumentix', ['Build with Jumentix', 'Jumentix Docs']],
  ['/docs/overview', ['Jumentix Overview', 'Jumentix Docs']],
  ['/docs/jumentix/concepts/getting-started', ['Getting started with Jumentix']],
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
  ['/docs/jumentix/packages/message-mediator/usage', ['message-mediator usage']],
  ['/docs/jumentix/packages/designer-core/usage', ['designer-core usage']],
  ['/docs/jumentix/packages/key-value-storage/usage', ['key-value-storage usage']],
  ['/docs/jumentix/packages/mutex-service/usage', ['mutex-service usage']],
  ['/docs/jumentix/packages/cana', ['@jumentix/cana', 'Try it in the browser']],
  ['/docs/jumentix/packages/cana/usage', ['Cana usage guide', 'Interactive playgrounds']],
  ['/docs/jumentix/reference/runtime-contracts', ['Runtime']],
  ['/docs/pt-BR/jumentix', ['Construa com o Jumentix']],
  ['/docs/pt-BR/jumentix/concepts', ['Conceitos']],
  ['/docs/pt-BR/jumentix/concepts/getting-started', ['Começando']],
  ['/docs/pt-BR/jumentix/guides/rest-api', ['Criando API REST com Jumentix']],
  ['/docs/pt-BR/jumentix/adapters', ['Adaptadores']],
  ['/docs/pt-BR/jumentix/adapters/http/express', ['Express']],
  ['/docs/pt-BR/jumentix/packages/message-mediator', ['@jumentix/message-mediator']],
  ['/docs/pt-BR/jumentix/packages/cana', ['@jumentix/cana']],
  ['/docs/pt-BR/jumentix/packages/cana/usage', ['Guia de uso do Cana', 'Playgrounds interativos']]
];

function playgroundIds(runtime, id) {
  const root = `docs-playground-${runtime}-${id}`;
  return {
    root,
    run: `${root}-run`,
    reset: `${root}-reset`,
    output: `${root}-output`
  };
}

describe('Cana playground', () => {
  it('runs and resets the getting-started playground', () => {
    const ids = playgroundIds('cana', 'getting-started');
    cy.visitQuiet('/docs/jumentix/packages/cana');
    cy.get(`[data-testid="${ids.root}"]`).should('exist');
    cy.get(`[data-testid="${ids.run}"]`).click();
    cy.get(`[data-testid="${ids.output}"]`, { timeout: 15000 })
      .should('exist')
      .and('contain.text', 'backend');
    cy.get(`[data-testid="${ids.reset}"]`).click();
    cy.get(`[data-testid="${ids.output}"]`).should('not.exist');
  });
});

describe('Docs playground matrix', () => {
  const playgrounds = [
    ['/docs/jumentix/packages/designer-core/usage', 'designer-core', 'getting-started'],
    ['/docs/jumentix/packages/key-value-storage/usage', 'key-value-storage', 'getting-started'],
    ['/docs/jumentix/packages/mutex-service/usage', 'mutex-service', 'getting-started'],
    ['/docs/jumentix/packages/message-mediator/usage', 'message-mediator', 'getting-started'],
    ['/docs/jumentix/guides/rest-api', 'sdk-rest-client', 'getting-started'],
    ['/docs/jumentix/guides/realtime-api', 'sdk-websocket-client', 'getting-started']
  ];

  for (const [path, runtime, id] of playgrounds) {
    it(`renders ${runtime} playground on ${path}`, () => {
      const ids = playgroundIds(runtime, id);
      cy.visitQuiet(path);
      cy.get(`[data-testid="${ids.root}"]`).should('exist');
      cy.get(`[data-testid="${ids.run}"]`).click();
      cy.get(`[data-testid="${ids.output}"]`, { timeout: 15000 }).should('exist');
      cy.get(`[data-testid="${ids.reset}"]`).click();
      cy.get(`[data-testid="${ids.output}"]`).should('not.exist');
    });
  }

  it('exposes AI surfaces', () => {
    cy.request('/llms.txt').its('status').should('eq', 200);
    cy.request('/docs-index.json').its('status').should('eq', 200);
    cy.request('/llms-full.txt').its('status').should('eq', 200);
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
