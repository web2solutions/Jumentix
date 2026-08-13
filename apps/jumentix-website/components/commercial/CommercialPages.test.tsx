import { render, screen, userEvent } from '@/test-utils';
import { getDocsSnippet } from '../docs-playground/catalogs';
import type { DocsRuntimeId } from '../docs-playground/types';
import { getCanaSnippet } from '../cana/snippets';
import {
  CommercialPage,
  CommercialUseCasePage,
  Home,
  Product,
  UseCases,
  Integrations,
  Architecture,
  Security,
  Engagement,
  Contact,
  Community,
  Roadmap,
} from '../commercial/CommercialPages';

describe('Commercial pages', () => {
  const renderPage = (page: Parameters<typeof CommercialPage>[0]['page'], locale: 'en' | 'pt-BR' = 'en') => {
    render(<CommercialPage locale={locale} page={page} />);
  };

  describe('Home page', () => {
    it('renders hero with badge, title, and actions (EN)', () => {
    expect.hasAssertions();
      renderPage('home', 'en');
      expect(screen.getByText('Open-source software factory')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Jumentix');
      expect(screen.getByAltText('Jumentix mascot, inspired by the Brazilian jegue')).toBeInTheDocument();
      expect(screen.getByText(/Brazilian jegue/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Start building' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Explore the platform' })).toBeInTheDocument();
    });

    it('renders hero with badge, title, and actions (PT-BR)', () => {
    expect.hasAssertions();
      renderPage('home', 'pt-BR');
      expect(screen.getByText('Fábrica de software open source')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Jumentix');
      expect(screen.getByAltText('Mascote Jumentix, inspirada no jegue brasileiro')).toBeInTheDocument();
      expect(screen.getByText(/jegue brasileiro/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Comece a construir' })).toBeInTheDocument();
    });

    it('renders proof metrics', () => {
    expect.hasAssertions();
      renderPage('home', 'en');
      expect(screen.getByText('99% quality threshold')).toBeInTheDocument();
      expect(screen.getByText('DDD + Hexagonal')).toBeInTheDocument();
      expect(screen.getByText('Bun monorepo')).toBeInTheDocument();
      expect(screen.getByText('Open source')).toBeInTheDocument();
      expect(screen.getByText('AI-ready platform')).toBeInTheDocument();
    });
  });

  describe('Product page', () => {
    it('renders platform capabilities feature grid (EN)', () => {
    expect.hasAssertions();
      renderPage('product', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A software factory your teams can evolve');
      expect(screen.getByText('Service Management')).toBeInTheDocument();
      expect(screen.getByText('Contract-first runtimes')).toBeInTheDocument();
      expect(screen.getByText('Reusable package ecosystem')).toBeInTheDocument();
      expect(screen.getByText('Portable persistence')).toBeInTheDocument();
      expect(screen.getByText('Service communication')).toBeInTheDocument();
      expect(screen.getByText('Governed delivery')).toBeInTheDocument();
      expect(screen.getByText('Domain Designer')).toBeInTheDocument();
      expect(screen.getAllByText('Backend Template').length).toBeGreaterThan(0);
      expect(screen.getByText('Generated SDKs')).toBeInTheDocument();
      expect(screen.getByText('Browser in-memory playgrounds')).toBeInTheDocument();
      expect(screen.getByText('Full Jumentix browser app')).toBeInTheDocument();
      expect(screen.getByText('Bulk write recovery')).toBeInTheDocument();
      expect(screen.getByText('Bulk writes with mutex + DLQ')).toBeInTheDocument();
      expect(screen.getByText('AI-ready platform')).toBeInTheDocument();
      expect(screen.getByText('AI work becomes governed delivery')).toBeInTheDocument();
      expect(screen.getByText(/Model service/)).toBeInTheDocument();
      expect(screen.getByText('Generate safely')).toBeInTheDocument();
      expect(screen.getByText('Ship with evidence')).toBeInTheDocument();
      expect(screen.getByText('UI blueprint')).toBeInTheDocument();
      expect(screen.getByText('PM2 operations')).toBeInTheDocument();
      expect(screen.getByText('Who uses what in the platform')).toBeInTheDocument();
      expect(screen.getByText('Platform team')).toBeInTheDocument();
    });

    it('renders architecture flow steps', () => {
    expect.hasAssertions();
      renderPage('product', 'en');
      expect(screen.getByText('Interface adapter')).toBeInTheDocument();
      expect(screen.getByText('Controller')).toBeInTheDocument();
      expect(screen.getByText('Use case and domain')).toBeInTheDocument();
      expect(screen.getByText('Output adapter')).toBeInTheDocument();
    });
  });

  describe('Use Cases page', () => {
    it('renders use case links grid', () => {
    expect.hasAssertions();
      renderPage('use-cases', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Start with the product you need now');
      expect(screen.getByRole('link', { name: /REST API/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Realtime API/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Modular SaaS/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Microservices/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /SPA and offline PWA/ })).toBeInTheDocument();
      expect(screen.getByText('Zero to first MVP')).toBeInTheDocument();
      expect(screen.getByText('Every use case is a launch path, not just an architecture label')).toBeInTheDocument();
      expect(screen.getByText('MVP stage')).toBeInTheDocument();
      expect(screen.getByText('Ready evidence')).toBeInTheDocument();
      expect(screen.getByText('When to choose each Jumentix path')).toBeInTheDocument();
      expect(screen.getByText('Shared foundation')).toBeInTheDocument();
      expect(screen.getByText('Contracts before adapters')).toBeInTheDocument();
    });
  });

  describe('Integrations page', () => {
    it('renders integration categories', () => {
    expect.hasAssertions();
      renderPage('integrations', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Choose infrastructure per service, not per platform');
      expect(screen.getByText('HTTP runtimes')).toBeInTheDocument();
      expect(screen.getByText('Realtime')).toBeInTheDocument();
      expect(screen.getByText('SQL')).toBeInTheDocument();
      expect(screen.getByText('NoSQL')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Messaging' })).toBeInTheDocument();
      expect(screen.getByText('Deployment')).toBeInTheDocument();
      expect(screen.getByText('How to pick the right adapter')).toBeInTheDocument();
      expect(screen.getByText('@jumentix/database-client-factory')).toBeInTheDocument();
      expect(screen.getAllByText('@jumentix/message-mediator').length).toBeGreaterThan(0);
      expect(screen.getByText('Browser in-memory playgrounds')).toBeInTheDocument();
      expect(screen.getByText('Bulk writes with mutex + DLQ')).toBeInTheDocument();
      expect(screen.getByText('PM2 operations')).toBeInTheDocument();
    });
  });

  describe('Architecture page', () => {
    it('renders architecture flow and capability table', () => {
    expect.hasAssertions();
      renderPage('architecture', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Domain ownership at the center, technology at the edges');
      expect(screen.getByText('External request')).toBeInTheDocument();
      expect(screen.getByText('Input adapter')).toBeInTheDocument();
      expect(screen.getByText('Application core')).toBeInTheDocument();
      expect(screen.getByText('Output port')).toBeInTheDocument();
      expect(screen.getByText('Domain isolation')).toBeInTheDocument();
      expect(screen.getByText('Interface portability')).toBeInTheDocument();
      expect(screen.getByText('What is allowed to know what')).toBeInTheDocument();
      expect(screen.getByText('Topology evolution')).toBeInTheDocument();
      expect(screen.getByText('Architecture governance')).toBeInTheDocument();
      expect(screen.getByText('Boundary checks')).toBeInTheDocument();
      expect(screen.getByText('AI-ready platform')).toBeInTheDocument();
      expect(screen.getByText('AI work becomes governed delivery')).toBeInTheDocument();
      expect(screen.getByText('Governance guardrail')).toBeInTheDocument();
      expect(screen.getByText('Browser in-memory playgrounds')).toBeInTheDocument();
      expect(screen.getByText('Bulk writes with mutex + DLQ')).toBeInTheDocument();
      expect(screen.getByText('PM2 operations')).toBeInTheDocument();
    });
  });

  describe('Security page', () => {
    it('renders security features', () => {
    expect.hasAssertions();
      renderPage('security', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Controls your audit can verify');
      expect(screen.getByText('RBAC')).toBeInTheDocument();
      expect(screen.getByText('PCI-oriented controls')).toBeInTheDocument();
      expect(screen.getByText('Secret-safe outputs')).toBeInTheDocument();
      expect(screen.getByText('Continuous evidence')).toBeInTheDocument();
    });
  });

  describe('Engagement page', () => {
    it('renders adoption journey cards', () => {
    expect.hasAssertions();
      renderPage('engagement', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Open source foundation. Enterprise operating model.');
      expect(screen.getByText('Community adoption')).toBeInTheDocument();
      expect(screen.getByText('Product pilot')).toBeInTheDocument();
      expect(screen.getByText('Platform rollout')).toBeInTheDocument();
    });
  });

  describe('Contact page', () => {
    it('renders contact links', () => {
    expect.hasAssertions();
      renderPage('contact', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bring your architecture challenge');
      expect(screen.getByRole('link', { name: /GitHub Discussions/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /GitHub Issues/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Enterprise conversation/ })).toBeInTheDocument();
    });
  });

  describe('Community page', () => {
    it('renders contribution guidelines', () => {
    expect.hasAssertions();
      renderPage('community', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Build the factory with us');
      expect(screen.getByText(/Discuss the problem before implementation/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Contribution guide' })).toBeInTheDocument();
    });
  });

  describe('Roadmap page', () => {
    it('renders roadmap phases', () => {
    expect.hasAssertions();
      renderPage('roadmap', 'en');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A public path from platform foundation to software factory');
      expect(screen.getByText('Now')).toBeInTheDocument();
      expect(screen.getByText('Monorepo consolidation')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Service factory workflows')).toBeInTheDocument();
      expect(screen.getByText('Later')).toBeInTheDocument();
      expect(screen.getByText('Ecosystem distribution')).toBeInTheDocument();
    });
  });

  describe('CommercialUseCasePage', () => {
    it('renders REST API use case page', () => {
    expect.hasAssertions();
      render(<CommercialUseCasePage locale="en" name="rest-api" />);
      expect(screen.getByText('Contract-first REST APIs without domain lock-in')).toBeInTheDocument();
      expect(screen.getByText('Native adapters for multiple Node.js HTTP runtimes')).toBeInTheDocument();
      expect(screen.getByText('From zero to first MVP')).toBeInTheDocument();
      expect(screen.getByText('Choose the first resource')).toBeInTheDocument();
      expect(screen.getByText('MVP scope')).toBeInTheDocument();
      expect(screen.getByText('MVP evidence')).toBeInTheDocument();
      expect(screen.getByText('Practical implementation')).toBeInTheDocument();
      expect(screen.getByText('Complete code for the first working slice')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'app.ts' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'openapi.yaml' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'client.ts' })).toBeInTheDocument();
    });

    it('renders Realtime API use case page', async () => {
    expect.hasAssertions();
      const user = userEvent.setup();
      render(<CommercialUseCasePage locale="en" name="realtime-api" />);
      expect(screen.getByText('Bidirectional APIs with a built-in fallback')).toBeInTheDocument();
      expect(screen.getByText('Correlated request/response messages')).toBeInTheDocument();
      expect(screen.getByText('Pick the live moment')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Release' }));
      expect(screen.getByText('Prove delivery and reconnect')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'server.ts' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'fallback.ts' })).toBeInTheDocument();
    });

    it('renders SaaS Monolith use case page', async () => {
    expect.hasAssertions();
      const user = userEvent.setup();
      render(<CommercialUseCasePage locale="en" name="saas-monolith" />);
      expect(screen.getByText('Launch one deployable, preserve every domain boundary')).toBeInTheDocument();
      expect(screen.getByText('Lower first-release operating cost')).toBeInTheDocument();
      expect(screen.getByText('Define the tenant-owned workflow')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Release' }));
      expect(screen.getByText('Protect the monolith boundaries')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'modules.ts' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'route.ts' })).toBeInTheDocument();
    });

    it('renders SaaS Microservices use case page', async () => {
    expect.hasAssertions();
      const user = userEvent.setup();
      render(<CommercialUseCasePage locale="en" name="saas-microservices" />);
      expect(screen.getByText('Scale services without rewriting communication')).toBeInTheDocument();
      expect(screen.getByText('Independent service ownership')).toBeInTheDocument();
      expect(screen.getByText('Extract only one boundary')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Release' }));
      expect(screen.getByText('Prove compatibility')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'contracts.ts' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'worker.ts' })).toBeInTheDocument();
    });

    it('renders SPA PWA use case page', async () => {
    expect.hasAssertions();
      const user = userEvent.setup();
      render(<CommercialUseCasePage locale="en" name="spa-pwa" />);
      expect(screen.getByText('Build installable products that keep working offline')).toBeInTheDocument();
      expect(screen.getByText('Offline-first data workflows')).toBeInTheDocument();
      expect(screen.getByText('Model local records')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Day 2' }));
      expect(screen.getByText('Connect state management')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'store.ts' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'TaskApp.tsx' })).toBeInTheDocument();
    });

    it('localizes to PT-BR', () => {
    expect.hasAssertions();
      render(<CommercialUseCasePage locale="pt-BR" name="rest-api" />);
      expect(screen.getByText('APIs REST orientadas a contratos sem aprisionar o domínio')).toBeInTheDocument();
      expect(screen.getByText('Adaptadores nativos para vários runtimes HTTP Node.js')).toBeInTheDocument();
      expect(screen.getByText('Do zero ao primeiro MVP')).toBeInTheDocument();
      expect(screen.getByText('Escolha o primeiro recurso')).toBeInTheDocument();
      expect(screen.getByText('Implementação prática')).toBeInTheDocument();
      expect(screen.getByText('Código completo para a primeira fatia funcional')).toBeInTheDocument();
    });
  });

  describe('MVP day-by-day journey (JUM-709)', () => {
    const docsPlaygroundRefs: ReadonlyArray<{ runtime: DocsRuntimeId; id: string }> = [
      { runtime: 'jumentix-browser-lab', id: 'rest-mvp-use-case' },
      { runtime: 'jumentix-browser-lab', id: 'rest-mvp-client' },
      { runtime: 'jumentix-browser-lab', id: 'realtime-mvp-live' },
      { runtime: 'jumentix-browser-lab', id: 'realtime-mvp-fallback' },
      { runtime: 'jumentix-browser-lab', id: 'saas-mvp-tenant' },
      { runtime: 'jumentix-browser-lab', id: 'micro-mvp-worker' },
      { runtime: 'jumentix-browser-lab', id: 'micro-mvp-dead-letter' },
      { runtime: 'message-mediator', id: 'micro-mvp-mediator' },
    ];
    const canaPlaygroundRefs = ['spa-mvp-offline', 'spa-mvp-events', 'spa-mvp-durability'] as const;

    it('every MVP playground reference resolves to a real executable snippet', () => {
    expect.hasAssertions();
      for (const ref of docsPlaygroundRefs) {
        const snippet = getDocsSnippet(ref.runtime, ref.id);
        expect(snippet).toBeDefined();
        expect(snippet?.code.length).toBeGreaterThan(0);
      }
      for (const id of canaPlaygroundRefs) {
        const snippet = getCanaSnippet(id);
        expect(snippet).toBeDefined();
        expect(snippet?.code.length).toBeGreaterThan(0);
      }
    });

    it('rest-api journey renders day tabs, tasks, executable playground, and done/defer (EN)', async () => {
    expect.hasAssertions();
      const user = userEvent.setup();
      render(<CommercialUseCasePage locale="en" name="rest-api" />);
      expect(screen.getByRole('tab', { name: 'Day 0' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Day 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Day 2' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Release' })).toBeInTheDocument();
      expect(screen.getByText('Pick create and list as the only MVP operations.')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Day 1' }));
      expect(screen.getByText('Prove the 201/400/404 validation rules with one Run in the executable playground.')).toBeInTheDocument();
      expect(screen.getByTestId('docs-playground-jumentix-browser-lab-rest-mvp-use-case')).toBeInTheDocument();
      expect(screen.getByText('Definition of done for the first MVP')).toBeInTheDocument();
      expect(screen.getByText('Invalid input fails with 400 and unknown categories with 404 before persistence.')).toBeInTheDocument();
      expect(screen.getByText('Deliberately out of scope')).toBeInTheDocument();
      expect(screen.getByText('Bulk operations and reporting endpoints.')).toBeInTheDocument();
    });

    it('realtime-api journey ships fallback parity evidence', () => {
    expect.hasAssertions();
      render(<CommercialUseCasePage locale="en" name="realtime-api" />);
      expect(screen.getByRole('tab', { name: 'Day 1' })).toBeInTheDocument();
      expect(screen.getByText('The REST fallback returns the same business result when the socket is unavailable.')).toBeInTheDocument();
      expect(screen.getByText('Presence, typing indicators, and history replay.')).toBeInTheDocument();
    });

    it('saas-monolith journey proves tenant isolation', () => {
    expect.hasAssertions();
      render(<CommercialUseCasePage locale="en" name="saas-monolith" />);
      expect(screen.getByText('A cross-tenant read or write fails in an automated test.')).toBeInTheDocument();
      expect(screen.getByText('Billing, plans, and subscription lifecycle.')).toBeInTheDocument();
    });

    it('saas-microservices journey proves the mediator before any broker', () => {
    expect.hasAssertions();
      render(<CommercialUseCasePage locale="en" name="saas-microservices" />);
      expect(screen.getByText('The in-memory mediator proves publish/subscribe before any broker is introduced.')).toBeInTheDocument();
      expect(screen.getByText('Service mesh and distributed tracing.')).toBeInTheDocument();
    });

    it('spa-pwa journey requires durable offline records', () => {
    expect.hasAssertions();
      render(<CommercialUseCasePage locale="en" name="spa-pwa" />);
      expect(screen.getByText('The create/list workflow works with the network disabled.')).toBeInTheDocument();
      expect(screen.getByText('Records survive a browser reload — durable IndexedDB, not localStorage.')).toBeInTheDocument();
      expect(screen.getByText('IndexedDB schema migrations beyond version 1.')).toBeInTheDocument();
    });

    it('rest-api journey localizes tasks and done criteria to PT-BR', () => {
    expect.hasAssertions();
      render(<CommercialUseCasePage locale="pt-BR" name="rest-api" />);
      expect(screen.getByRole('tab', { name: 'Dia 0' })).toBeInTheDocument();
      expect(screen.getByText('Escolha create e list como únicas operações do MVP.')).toBeInTheDocument();
      expect(screen.getByText('Critérios de pronto do primeiro MVP')).toBeInTheDocument();
      expect(screen.getByText('Input inválido falha com 400 e categoria desconhecida com 404 antes da persistência.')).toBeInTheDocument();
      expect(screen.getByText('Fora de escopo de propósito')).toBeInTheDocument();
    });

    it('use-cases index renders the demo-ready checklist', () => {
    expect.hasAssertions();
      renderPage('use-cases', 'en');
      expect(screen.getByText('Demo-ready checklist')).toBeInTheDocument();
    });
  });
});
