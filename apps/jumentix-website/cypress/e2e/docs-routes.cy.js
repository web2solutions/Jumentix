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
  ['/docs/jumentix/packages/cana/react-context', ['Cana with React Context API', 'React Context: Category and Task tables']],
  ['/docs/jumentix/packages/cana/react-redux', ['Cana with React Redux', 'React Redux: store updated by Cana events']],
  ['/docs/jumentix/packages/cana/vue-pinia', ['Cana with Vue 3 and Pinia', 'Vue 3 + Pinia: store patched from Cana']],
  ['/docs/jumentix/packages', ['Jumentix packages', 'consumer map']],
  ['/docs/jumentix/packages/external-db-repositories', ['Responsibility in context']],
  ['/docs/jumentix/packages/sdk-rest-client', ['@jumentix/sdk-rest-client']],
  ['/docs/jumentix/apps/backend-template', ['backend-template']],
  ['/docs/jumentix/apps/service-management', ['service-management']],
  ['/docs/jumentix/apps/jumentix-website', ['jumentix-website']],
  ['/docs/jumentix/reference/runtime-contracts', ['Runtime']],
  ['/docs/pt-BR/jumentix', ['Construa com o Jumentix']],
  ['/docs/pt-BR/jumentix/concepts', ['Conceitos']],
  ['/docs/pt-BR/jumentix/concepts/getting-started', ['Começando']],
  ['/docs/pt-BR/jumentix/guides/rest-api', ['Criando API REST com Jumentix']],
  ['/docs/pt-BR/jumentix/adapters', ['Adaptadores']],
  ['/docs/pt-BR/jumentix/adapters/http/express', ['Express']],
  ['/docs/pt-BR/jumentix/packages/message-mediator', ['@jumentix/message-mediator']],
  ['/docs/pt-BR/jumentix/packages/cana', ['@jumentix/cana']],
  ['/docs/pt-BR/jumentix/packages/cana/usage', ['Guia de uso do Cana', 'Playgrounds interativos']],
  ['/docs/pt-BR/jumentix/packages/cana/react-context', ['Cana com React Context API', 'React Context: tabelas Category e Task']],
  ['/docs/pt-BR/jumentix/packages/cana/react-redux', ['Cana com React Redux', 'React Redux: store atualizada por events Cana']],
  ['/docs/pt-BR/jumentix/packages/cana/vue-pinia', ['Cana com Vue 3 e Pinia', 'Vue 3 + Pinia: store atualizada pelo Cana']]
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
    assertNoVisibleAgentOnlyMetadata();
    assertAgentMarkdownPayload(`[data-testid="${ids.root}"]`);
    cy.get(`[data-testid="${ids.run}"]`).click();
    cy.get(`[data-testid="${ids.output}"]`, { timeout: 15000 })
      .should('exist')
      .and('contain.text', 'backend');
    cy.get(`[data-testid="${ids.reset}"]`).click();
    cy.get(`[data-testid="${ids.output}"]`).should('not.exist');
  });
});

function canaFrameworkIds(id) {
  const root = `cana-framework-playground-${id}`;
  return {
    root,
    run: `${root}-run`,
    reset: `${root}-reset`,
    output: `${root}-output`
  };
}

function assertDarkDocsThemeIsReadable() {
  cy.document().then((document) => {
    const win = document.defaultView;
    const htmlBackground = win.getComputedStyle(document.documentElement).backgroundColor;
    const bodyBackground = win.getComputedStyle(document.body).backgroundColor;
    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).to.equal('dark');
    expect([htmlBackground, bodyBackground], 'docs page background should not flip to white')
      .not.to.include('rgb(255, 255, 255)');
  });
}

function assertMonacoMounted(scopeSelector) {
  cy.get(scopeSelector).find('.jtx-monaco-code').should('exist');
  cy.get(scopeSelector).find('.monaco-editor', { timeout: 20000 }).should('exist');
}

function textNodeIsVisible(node) {
  let element = node.parentElement;
  while (element) {
    const style = node.ownerDocument.defaultView.getComputedStyle(element);
    if (
      element.hidden ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}

function assertNoVisibleAgentOnlyMetadata() {
  cy.document().then((document) => {
    const walker = document.createTreeWalker(
      document.body,
      document.defaultView.NodeFilter.SHOW_TEXT
    );
    const visibleMatches = [];
    let node = walker.nextNode();
    while (node) {
      const text = node.nodeValue || '';
      if (
        (/Code \(copy for agents\/LLMs\)/i.test(text) || /^Source:\s*/i.test(text.trim())) &&
        textNodeIsVisible(node)
      ) {
        visibleMatches.push(text.trim());
      }
      node = walker.nextNode();
    }
    expect(visibleMatches, 'agent-only code labels and source metadata should be hidden')
      .to.deep.equal([]);
  });
}

function assertAgentMarkdownPayload(rootSelector) {
  cy.get(rootSelector)
    .find('[data-agent-markdown="docs-playground-static-code"]')
    .should('exist')
    .and('not.be.visible')
    .and('contain.text', '```ts');
}

describe('Cana framework tutorial playgrounds', () => {
  const tutorials = [
    ['/docs/jumentix/packages/cana/react-context', ['react-context-basic', 'react-context-advanced']],
    ['/docs/jumentix/packages/cana/react-redux', ['react-redux-basic', 'react-redux-advanced']],
    ['/docs/jumentix/packages/cana/vue-pinia', ['vue-pinia-basic', 'vue-pinia-advanced']]
  ];

  for (const [path, exampleIds] of tutorials) {
    it(`runs every Cana framework playground on ${path}`, () => {
      cy.visitQuiet(path);
      assertDarkDocsThemeIsReadable();
      assertNoVisibleAgentOnlyMetadata();

      for (const exampleId of exampleIds) {
        const ids = canaFrameworkIds(exampleId);
        cy.get(`[data-testid="${ids.root}"]`).should('exist');
        assertMonacoMounted(`[data-testid="${ids.root}"]`);
        cy.get(`[data-testid="${ids.run}"]`).click();
        assertDarkDocsThemeIsReadable();
        cy.get(`[data-testid="${ids.output}"]`, { timeout: 15000 })
          .should('exist')
          .and('contain.text', 'tasks');
        cy.get(`[data-testid="${ids.reset}"]`).click();
        cy.get(`[data-testid="${ids.output}"]`).should('not.exist');
      }
    });
  }
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
      assertNoVisibleAgentOnlyMetadata();
      assertAgentMarkdownPayload(`[data-testid="${ids.root}"]`);
      assertMonacoMounted(`[data-testid="${ids.root}"]`);
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


describe('designer-core playground', () => {
  it('validates the sample design on spa-pwa', () => {
    const ids = playgroundIds('designer-core', 'getting-started');
    cy.visitQuiet('/docs/jumentix/guides/spa-pwa');
    cy.get(`[data-testid="${ids.root}"]`).should('exist');
    assertNoVisibleAgentOnlyMetadata();
    assertAgentMarkdownPayload(`[data-testid="${ids.root}"]`);
    assertMonacoMounted(`[data-testid="${ids.root}"]`);
    cy.get(`[data-testid="${ids.run}"]`).click();
    cy.get(`[data-testid="${ids.output}"]`, { timeout: 15000 })
      .should('exist')
      .and('contain.text', 'ok');
  });
});

describe('documentation routes and compatibility redirects', () => {
  for (const [path, includes] of documentationRoutes) {
    it(`renders ${path}`, () => {
      cy.visitQuiet(path);
      assertNoVisibleAgentOnlyMetadata();
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

/**
 * JUM-664 — a ```mermaid fence must reach the reader as a diagram.
 *
 * Every fence in this documentation was a blank space on the published page for
 * as long as the fences have existed, and nothing reported it: no console error,
 * no failed request, no test. This is that report, and it is deliberately a
 * browser test — "the component rendered" is not the claim. The claim is that a
 * reader loading the page sees an `<svg>`.
 *
 * Requirement 132: an artifact that exists in the source, is committed, and
 * never reaches a reader is the same defect class as the orphaned content pages.
 */
describe('Mermaid diagrams (JUM-664)', () => {
  const pagesWithDiagrams = [
    '/docs/jumentix/adapters/realtime/websocket-api',
    '/docs/jumentix/adapters/realtime/grpc-api'
  ];

  pagesWithDiagrams.forEach((path) => {
    it(`renders every diagram on ${path}`, () => {
      cy.visitQuiet(path);

      // Present at all: the fence has to become a diagram element, not a code
      // block that quietly kept its text.
      cy.get('[data-testid="mermaid"]').should('have.length.at.least', 1);

      // And rendered without anything having to scroll — the patched component
      // no longer waits for an intersection its empty container could never
      // report.
      //
      // Re-queried rather than wrapped: the container is replaced when its SVG
      // arrives, so a held reference detaches mid-assertion. Counting the
      // rendered ones against the total is also the stronger claim — `each`
      // over a stale collection would pass while a later diagram stayed blank.
      cy.get('[data-testid="mermaid"]').its('length').then((total) => {
        cy.get('[data-testid="mermaid"][data-rendered="true"]', { timeout: 20000 })
          .should('have.length', total);
        cy.get('[data-testid="mermaid"] svg').should('have.length.at.least', total);
      });

      // A diagram that fails to parse now renders its source instead of
      // nothing, which is visible — and must not be what ships.
      cy.get('[data-testid="mermaid-fallback"]').should('not.exist');
    });
  });
});
