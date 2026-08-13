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

  it('jumentix browser lab demonstrates mutex rejection and dead-letter replay through controllers', () => {
    expect.hasAssertions();
    const snippet = listDocsSnippets('jumentix-browser-lab').find((s) => s.id === 'bulk-mutex-dead-letter');
    expect(snippet?.title.en).toBe('Bulk writes with mutex + DLQ');
    expect(snippet?.description.en).toContain('force lock contention');
    expect(snippet?.code).toContain('api.createCanaDatabaseClient');
    expect(snippet?.code).toContain('React.createContext');
    expect(snippet?.code).toContain('BulkImportPanel');
    expect(snippet?.code).toContain('react-component-click');
    expect(snippet?.code).toContain('react-context-complete');
    expect(snippet?.code).toContain('react-component-render');
    expect(snippet?.code).toContain('database.subscribe');
    expect(snippet?.code).toContain("worker.client.add('tasks', records[0])");
    expect(snippet?.code).toContain('databaseSnapshot');
    expect(snippet?.code).toContain('canaEvents');
    expect(snippet?.code).toContain('streamDurationMs = 30000');
    expect(snippet?.code).toContain('maxConcurrentRequestsPerClient');
    expect(snippet?.code).toContain('startStream');
    expect(snippet?.code).toContain('reportPlaygroundProgress');
    expect(snippet?.code).not.toContain('requestTotal = 10000');
    expect(snippet?.code).toContain('reactClientIds');
    expect(snippet?.code).toContain('createCanaWorkerShard');
    expect(snippet?.code).toContain('api.createCanaRouter');
    expect(snippet?.code).toContain('api.createCanaWorkerHost');
    expect(snippet?.code).toContain('api.createCanaWorkerClient');
    expect(snippet?.code).toContain('workerShards');
    expect(snippet?.code).toContain('worker.client.bulkAdd');
    expect(snippet?.code).toContain('writeTasksWithCanaWorkers');
    expect(snippet?.code).toContain('recordIndexedDbQuota');
    expect(snippet?.code).toContain('navigator.storage.estimate');
    expect(snippet?.code).toContain('storageUsageSamples');
    expect(snippet?.code).toContain("name: 'byClient'");
    expect(snippet?.code).toContain("name: 'byWorker'");
    expect(snippet?.code).not.toContain('api.createInMemoryDatabase');
    expect(snippet?.code).toContain('stopNewRequestsAfterMs');
    expect(snippet?.code).toContain('client-ingestion-stopped');
    expect(snippet?.code).toContain('client-request-interrupted');
    expect(snippet?.code).toContain('interruptedBeforeController');
    expect(snippet?.code).toContain('api.createDeadLetterQueue({ maxAttempts: 3 })');
    expect(snippet?.code).toContain("name: 'dead-letter.enqueued'");
    expect(snippet?.code).toContain('deadLetterQueue.enqueue');
    expect(snippet?.code).toContain('deadLetterQueue.settle');
    expect(snippet?.code).toContain("mode: 'worker-bulk-add'");
    expect(snippet?.code).toContain('pendingDeadLettersAfterReplay');
    expect(snippet?.code).toContain('deadLetterQueueFullyProcessed');
    expect(snippet?.code).toContain('jobsAccountedFor');
    expect(snippet?.code).toContain('noLostJobs');
    expect(snippet?.code).toContain('createTaskController({');
    expect(snippet?.code).toContain("step: request.replay ? 'controller-replay' : 'controller-create'");
    expect(snippet?.code).toContain('Promise.all(request.body.tasks.map');
    expect(snippet?.code).toContain('rejectedToDeadLetterQueue');
    expect(snippet?.code).toContain('requestTimeline: timeline');
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
    expect(screen.getByTestId('docs-playground-cana-getting-started')).toHaveAttribute('id', 'playground-cana-getting-started');
    expect(screen.getByTestId('docs-playground-cana-getting-started-run')).toBeInTheDocument();

    const agentMarkdown = screen.getByTestId('docs-playground-cana-getting-started-static');
    expect(screen.queryByText('Code (copy for agents/LLMs)')).not.toBeInTheDocument();
    expect(agentMarkdown).not.toBeVisible();
    expect(agentMarkdown).toHaveAttribute('data-agent-markdown', 'docs-playground-static-code');
    expect(agentMarkdown).toHaveTextContent('```ts');
  });

  it('renders a canvas flow for the bulk mutex dead-letter playground with red rejected-flow semantics', () => {
    expect.hasAssertions();
    render(<DocsPlayground runtime="jumentix-browser-lab" id="bulk-mutex-dead-letter" />);
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-canvas')).toBeInTheDocument();
    expect(screen.getByText('Live data flow')).toBeInTheDocument();
    expect(screen.getByText('Rejected by lock')).toBeInTheDocument();
    expect(screen.getByText('Input stopped')).toBeInTheDocument();
    expect(screen.getByText(/One merged canvas follows concurrent requests for 30 seconds/i)).toBeInTheDocument();
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('Real events: 0');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('React clients: 0');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('Cana workers: 0');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('Interrupted before controller: 0');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('DLQ drained: no');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('No lost jobs: no');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('Cana events: 0');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('IndexedDB quota: 0.0000%');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('Window: 30s');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-flow-state')).toHaveTextContent('Concurrency/client: 12');
    expect(screen.getByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-metrics-charts')).toBeInTheDocument();
    expect(screen.getByText('Request outcomes')).toBeInTheDocument();
    expect(screen.getByText('Realtime flow')).toBeInTheDocument();
    expect(screen.getAllByText(/processed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rejected/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/replayed/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Message Mediator')).toBeInTheDocument();
    expect(screen.getAllByText('Cana workers').length).toBeGreaterThan(0);
    expect(screen.getByText('Shutdown health')).toBeInTheDocument();
    expect(screen.queryByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-start-again')).not.toBeInTheDocument();
    expect(screen.queryByTestId('docs-playground-jumentix-browser-lab-bulk-mutex-dead-letter-cana-flow-canvas')).not.toBeInTheDocument();
  });
});
