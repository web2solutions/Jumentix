import { render, screen } from '@/test-utils';
import { CANA_FRAMEWORK_EXAMPLES, getCanaFrameworkExample } from './catalog';
import { CanaFrameworkPlayground } from './CanaFrameworkPlayground';

describe('Cana framework playground catalog', () => {
  it('covers the requested framework examples', () => {
    expect.hasAssertions();
    expect(CANA_FRAMEWORK_EXAMPLES.map((example) => example.id)).toEqual([
      'react-context-basic',
      'react-context-advanced',
      'react-redux-basic',
      'react-redux-advanced',
      'vue-pinia-basic',
      'vue-pinia-advanced'
    ]);
  });

  it('ships complete implementation files for every example', () => {
    expect.hasAssertions();
    for (const example of CANA_FRAMEWORK_EXAMPLES) {
      expect(example.files.length).toBeGreaterThanOrEqual(2);
      expect(example.files.some((file) => file.path.endsWith('cana.ts'))).toBe(true);
      expect(example.files.map((file) => file.source).join('\n')).toContain('createClient');
      expect(example.files.map((file) => file.source).join('\n')).toMatch(/subscribe|CanaChangeEvent/);
    }
  });

  it('finds a known example by id', () => {
    expect.hasAssertions();
    expect(getCanaFrameworkExample('react-redux-advanced')?.framework).toBe('React Redux');
  });
});

describe('CanaFrameworkPlayground', () => {
  it('renders controls, preview, and implementation code', () => {
    expect.hasAssertions();
    render(<CanaFrameworkPlayground id="react-context-basic" />);
    expect(screen.getByTestId('cana-framework-playground-react-context-basic')).toBeInTheDocument();
    expect(screen.getByTestId('cana-framework-playground-react-context-basic-run')).toBeInTheDocument();
    expect(screen.getByTestId('cana-framework-playground-react-context-basic-reset')).toBeInTheDocument();
    expect(screen.getByTestId('cana-framework-playground-react-context-basic-preview'))
      .toHaveClass('cana-framework-preview');
    expect(screen.getByText('React Context: categorized task list')).toBeInTheDocument();
    expect(screen.getAllByText(/TasksProvider.tsx/).length).toBeGreaterThan(0);
  });
});
