import { render, screen, waitFor } from '@/test-utils';
import { monacoTestState, resetMonacoTestState } from '../../test/mocks/monaco-editor';
import { MDXMonacoPre } from './MDXMonacoPre';

describe('MDXMonacoPre', () => {
  beforeEach(() => {
    resetMonacoTestState();
  });

  it('renders the complete code block when MDX splits pre children', async () => {
    expect.hasAssertions();

    render(
      <MDXMonacoPre>
        <code className="language-ts">{'const client = createClient({\n'}</code>
        <code>{'  schema: {\n'}</code>
        <code>{'    stores: [\n'}</code>
        <code>{"      { name: 'categories', keyPath: 'id' }\n"}</code>
        <code>{'    ]\n'}</code>
        <code>{'  }\n'}</code>
        <code>{'});\n\n'}</code>
      </MDXMonacoPre>
    );

    await waitFor(() => expect(monacoTestState.models).toHaveLength(1));

    const [model] = monacoTestState.models;
    expect(model.language).toBe('typescript');
    expect(model.getValue()).toContain("{ name: 'categories', keyPath: 'id' }");
    expect(model.getValue()).toBe([
      'const client = createClient({',
      '  schema: {',
      '    stores: [',
      "      { name: 'categories', keyPath: 'id' }",
      '    ]',
      '  }',
      '});'
    ].join('\n'));
    expect(screen.getByText(/categories/)).toBeInTheDocument();
  });

  it('keeps empty pre blocks as plain pre elements', () => {
    expect.hasAssertions();

    const { container } = render(<MDXMonacoPre>{''}</MDXMonacoPre>);

    expect(container.querySelector('pre')).toBeInTheDocument();
    expect(monacoTestState.models).toHaveLength(0);
  });
});
