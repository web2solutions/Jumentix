import { render, screen } from '@/test-utils';
import { DocsPlayground } from './DocsPlayground';
import { listDocsSnippets } from './catalogs';

describe('DocsPlayground catalogs', () => {
  it('exposes getting-started for each runtime', () => {
    for (const runtime of [
      'cana',
      'designer-core',
      'key-value-storage',
      'message-mediator',
      'mutex-service',
      'sdk-rest-client',
      'sdk-websocket-client'
    ] as const) {
      expect(listDocsSnippets(runtime).some((s) => s.id === 'getting-started')).toBe(true);
    }
  });
});

describe('DocsPlayground', () => {
  it('renders Run/Reset and static code for cana', () => {
    render(<DocsPlayground runtime="cana" id="getting-started" />);
    expect(screen.getByTestId('docs-playground-cana-getting-started')).toBeInTheDocument();
    expect(screen.getByTestId('docs-playground-cana-getting-started-run')).toBeInTheDocument();
    expect(screen.getByTestId('docs-playground-cana-getting-started-static')).toBeInTheDocument();
  });
});
