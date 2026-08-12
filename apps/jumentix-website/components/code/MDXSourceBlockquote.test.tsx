import { render, screen } from '@/test-utils';
import { createMDXSourceBlockquote } from './MDXSourceBlockquote';

describe('MDXSourceBlockquote', () => {
  it('keeps generated source metadata hidden for agents', () => {
    const Blockquote = createMDXSourceBlockquote('blockquote');
    const { container } = render(
      <Blockquote>
        Source: <code>../../packages/cana/README.md</code>
      </Blockquote>
    );

    const source = screen.getByText(/Source:/);
    expect(source).not.toBeVisible();
    expect(source).toHaveAttribute('data-doc-source');
    expect(source).toHaveAttribute('data-agent-metadata', 'source');
    expect(container.querySelector('blockquote')).not.toBeInTheDocument();
  });

  it('renders normal blockquotes through the default component', () => {
    const Blockquote = createMDXSourceBlockquote('blockquote');
    const { container } = render(<Blockquote>Keep this visible.</Blockquote>);

    expect(container.querySelector('blockquote')).toHaveTextContent('Keep this visible.');
  });
});
