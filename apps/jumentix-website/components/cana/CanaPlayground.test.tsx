import { render, screen } from '@/test-utils';
import { CanaPlayground } from './CanaPlayground';
import { CANA_SNIPPETS, getCanaSnippet } from './snippets';

describe('Cana playground catalog', () => {
  it('covers the public-feature matrix ids', () => {
    expect.hasAssertions();
    const ids = CANA_SNIPPETS.map((snippet) => snippet.id);
    expect(ids).toEqual(expect.arrayContaining([
      'getting-started',
      'schema-versioning',
      'keys',
      'crud',
      'bulk',
      'query-explain',
      'transactions',
      'change-events',
      'hooks',
      'errors',
      'storage-durability',
      'crash-recovery',
      'export-import',
      'fallback-backend',
      'factory-adapter'
    ]));
    expect(getCanaSnippet('getting-started')?.code).toContain('createClient');
  });
});

describe('CanaPlayground', () => {
  it('renders Run and Reset for a known snippet', () => {
    expect.hasAssertions();
    render(<CanaPlayground id="getting-started" />);
    expect(screen.getByTestId('cana-playground-getting-started')).toBeInTheDocument();
    expect(screen.getByTestId('cana-playground-run-getting-started')).toBeInTheDocument();
    expect(screen.getByTestId('cana-playground-reset-getting-started')).toBeInTheDocument();
  });
});
