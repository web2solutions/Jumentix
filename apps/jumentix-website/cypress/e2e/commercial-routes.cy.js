const englishRoutes = [
  ['/', ['Open-source software factory', 'Domain Designer']],
  ['/product', ['A software factory your teams can evolve', 'Platform capabilities']],
  ['/use-cases', ['Start with the product you need now', 'REST API']],
  ['/use-cases/rest-api', ['Contract-first REST APIs', 'OpenAPI 3.1']],
  ['/use-cases/realtime-api', ['Bidirectional APIs', 'Socket.IO']],
  ['/use-cases/saas-monolith', ['Launch one deployable', 'Lower first-release']],
  ['/use-cases/saas-microservices', ['Scale services', 'Request/response']],
  ['/use-cases/spa-pwa', ['keep working offline', 'IndexedDB']],
  ['/integrations', ['Choose infrastructure per service', 'MongoDB']],
  ['/architecture', ['Domain ownership at the center', 'Backend-template hexagonal map', 'Application core']],
  ['/security-compliance', ['Controls your audit can verify', 'RBAC']],
  ['/community', ['Build the factory with us', 'Every contribution']],
  ['/roadmap', ['A public path', 'Monorepo consolidation']],
  ['/contact', ['Bring your architecture challenge', 'GitHub Discussions']],
  ['/pricing-or-engagement', ['Open source foundation', 'Product pilot']],
  ['/changelog?page=1', ['Jumentix changelog']]
];

const portugueseRoutes = [
  ['/pt-BR', ['Fábrica de software open source', 'Domain Designer']],
  ['/pt-BR/product', ['Uma fábrica de software', 'Capacidades da plataforma']],
  ['/pt-BR/use-cases', ['Comece com o produto', 'API REST']],
  ['/pt-BR/use-cases/rest-api', ['APIs REST orientadas', 'OpenAPI 3.1']],
  ['/pt-BR/use-cases/realtime-api', ['APIs bidirecionais', 'Socket.IO']],
  ['/pt-BR/use-cases/saas-monolith', ['Lance um deploy', 'Menor custo']],
  ['/pt-BR/use-cases/saas-microservices', ['Escale serviços', 'request/response']],
  ['/pt-BR/use-cases/spa-pwa', ['continuam funcionando offline', 'IndexedDB']],
  ['/pt-BR/integrations', ['Escolha a infraestrutura', 'MongoDB']],
  ['/pt-BR/architecture', ['Domínio no centro', 'Mapa hexagonal do backend-template', 'Núcleo da aplicação']],
  ['/pt-BR/security-compliance', ['Controles que sua auditoria', 'RBAC']],
  ['/pt-BR/community', ['Construa a fábrica conosco', 'Toda contribuição']],
  ['/pt-BR/roadmap', ['Um caminho público', 'Consolidação do monorepo']],
  ['/pt-BR/contact', ['Traga seu desafio', 'GitHub Discussions']],
  ['/pt-BR/pricing-or-engagement', ['Fundação open source', 'Piloto de produto']],
  ['/pt-BR/changelog?page=1', ['Changelog do Jumentix']]
];

function assertOptionalMonacoWidgetsMount() {
  cy.get('body').then(($body) => {
    if ($body.find('.jtx-monaco-code').length > 0) {
      cy.get('.monaco-editor', { timeout: 20000 }).should('exist');
    }
  });
}

describe('commercial routes (EN + PT-BR)', () => {
  for (const [path, includes] of [...englishRoutes, ...portugueseRoutes]) {
    it(`renders ${path}`, () => {
      cy.visitQuiet(path);
      cy.get('body').should('be.visible');
      for (const fragment of includes) {
        cy.contains(fragment).should('exist');
      }
      assertOptionalMonacoWidgetsMount();
      cy.get('nav[aria-label="Main navigation"]').should('exist');
    });
  }

  it('preserves the route when switching locale from product', () => {
    cy.visitQuiet('/product');
    cy.get('a[aria-label="Switch language to PT-BR"]').click();
    cy.location('pathname').should('eq', '/pt-BR/product');
  });
});
