import { render, screen } from '@/test-utils';
import { DocsPlayground } from './DocsPlayground';
import { listDocsSnippets } from './catalogs';

describe('DocsPlayground catalogs', () => {
  it('exposes getting-started for each runtime', () => {
    expect.hasAssertions();
    for (const runtime of [
      'cana',
      'designer-core',
      'jumentix-browser-lab',
      'key-value-storage',
      'message-mediator',
      'mutex-service',
      'sdk-rest-client',
      'sdk-websocket-client'
    ] as const) {
      expect(listDocsSnippets(runtime).some((s) => s.id === 'getting-started')).toBe(true);
    }
  });

  it('designer-core getting-started uses real sample/normalize/collect APIs', () => {
    expect.hasAssertions();
    const snippet = listDocsSnippets('designer-core').find((s) => s.id === 'getting-started');
    expect(snippet?.code).toContain('buildSampleModelPayload');
    expect(snippet?.code).toContain('normalizeStatePayload');
    expect(snippet?.code).toContain('collectModelIssues');
    expect(snippet?.code).not.toMatch(/version:\s*1/);
  });

  it('jumentix browser lab demonstrates complete in-memory task contracts', () => {
    expect.hasAssertions();
    const snippet = listDocsSnippets('jumentix-browser-lab').find((s) => s.id === 'getting-started');
    expect(snippet?.code).toContain("stores: ['categories', 'tasks']");
    expect(snippet?.code).toContain('tasks.create.v1');
    expect(snippet?.code).toContain('categories.get.v1');
    expect(snippet?.code).toContain('tasks.board.v1');
    expect(snippet?.code).toContain("composedBy: ['Tasks', 'Categories']");
    expect(snippet?.code).toContain('createRestClient');
    expect(snippet?.code).toContain('createWebSocketClient');
    expect(snippet?.code).not.toMatch(/textoEvento|criarDadosIniciais|carregarTudo/);
  });

  it('message mediator playground composes data across domains', () => {
    expect.hasAssertions();
    const snippet = listDocsSnippets('message-mediator').find((s) => s.id === 'getting-started');
    expect(snippet?.description.en).toContain('Exchange messages between Category and Task domains');
    expect(snippet?.code).toContain('categories.get.v1');
    expect(snippet?.code).toContain('tasks.board.v1');
    expect(snippet?.code).toContain("sourceDomain: 'Tasks'");
    expect(snippet?.code).toContain("composedFrom: ['Tasks', 'Categories']");
    expect(snippet?.code).toContain('domainMessages');
  });
});

describe('DocsPlayground', () => {
  it('renders Run/Reset and keeps agent code as hidden markdown for cana', () => {
    expect.hasAssertions();
    render(<DocsPlayground runtime="cana" id="getting-started" />);
    expect(screen.getByTestId('docs-playground-cana-getting-started')).toBeInTheDocument();
    expect(screen.getByTestId('docs-playground-cana-getting-started-run')).toBeInTheDocument();

    const agentMarkdown = screen.getByTestId('docs-playground-cana-getting-started-static');
    expect(screen.queryByText('Code (copy for agents/LLMs)')).not.toBeInTheDocument();
    expect(agentMarkdown).not.toBeVisible();
    expect(agentMarkdown).toHaveAttribute('data-agent-markdown', 'docs-playground-static-code');
    expect(agentMarkdown).toHaveTextContent('```ts');
  });
});
