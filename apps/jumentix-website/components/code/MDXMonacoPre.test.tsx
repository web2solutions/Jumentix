import { render, screen, waitFor } from '@/test-utils';
import { monacoTestState, resetMonacoTestState } from '../../test/mocks/monaco-editor';
import { MDXCodeSourceProvider, parseMDXCodeBlocks } from './MDXCodeSourceProvider';
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

  it('expands documentation code blocks to their full natural height', async () => {
    expect.hasAssertions();

    const longCode = Array.from({ length: 48 }, (_, index) => `const line${index + 1} = ${index + 1};`).join('\n');
    const { container } = render(
      <MDXMonacoPre>
        <code className="language-ts">{longCode}</code>
      </MDXMonacoPre>
    );

    await waitFor(() => expect(monacoTestState.models).toHaveLength(1));

    const root = container.querySelector('.jtx-monaco-code') as HTMLElement;
    expect(root.style.getPropertyValue('--jtx-monaco-height')).toBe('988px');
  });

  it('uses the original MDX fence when highlighted children arrive truncated', async () => {
    expect.hasAssertions();

    const fullCode = [
      'type HttpAdapterChoice = {',
      '  adapter: string;',
      '  runtime: string;',
      '  command?: string;',
      '};',
      '',
      'const choices: HttpAdapterChoice[] = [',
      "  { adapter: 'express', runtime: 'Node/Bun process', command: 'bun run dev:express' },",
      "  { adapter: 'fastify', runtime: 'Node/Bun process', command: 'bun run dev:fastify' },",
      "  { adapter: 'restify', runtime: 'Node/Bun process', command: 'bun run dev:restify' },",
      "  { adapter: 'cloudflare-workers', runtime: 'Edge Fetch handler' }",
      '];',
      '',
      'export function chooseHttpAdapter(adapter: string): HttpAdapterChoice {',
      '  const choice = choices.find((item) => item.adapter === adapter);',
      '',
      '  if (!choice) {',
      "    throw new Error('Unsupported HTTP adapter: ' + adapter);",
      '  }',
      '',
      '  return choice;',
      '}'
    ].join('\n');
    const truncatedHighlight = [
      <span key="1"><span>type</span><span> HttpAdapterChoice</span><span>{' = {'}</span></span>,
      '\n',
      <span key="2"><span>  adapter</span><span>: string;</span></span>,
      '\n',
      <span key="3"><span>  runtime</span><span>: string;</span></span>,
      '\n',
      <span key="4"><span>  command</span><span>?: string;</span></span>,
      '\n',
      <span key="5"><span>{'};'}</span></span>,
      '\n',
      <span key="6"> </span>,
      '\n',
      <span key="7"><span>const</span><span> choices: HttpAdapterChoice[] = [</span></span>,
      '\n',
      <span key="8"><span>{"  { adapter: 'express', runtime: 'Node/Bun process', command: 'bun run dev:express' },"}</span></span>,
      '\n',
      <span key="9"><span>{"  { adapter: 'fastify', runtime: 'Node/Bun process', command: 'bun run dev:fastify' },"}</span></span>,
      '\n',
      <span key="10"><span>{"  { adapter: 'restify', runtime: 'Node/Bun process'"}</span></span>
    ];

    render(
      <MDXCodeSourceProvider sourceCode={`# HTTP Adapters\n\n\`\`\`ts\n${fullCode}\n\`\`\``}>
        <MDXMonacoPre>
          <code className="language-ts">{truncatedHighlight}</code>
        </MDXMonacoPre>
      </MDXCodeSourceProvider>
    );

    await waitFor(() => expect(monacoTestState.models).toHaveLength(1));

    const [model] = monacoTestState.models;
    expect(model.getValue()).toBe(fullCode);
    expect(model.getValue()).toContain('Unsupported HTTP adapter');
  });

  it('parses fenced code from MDX source without trailing blank lines', () => {
    expect.hasAssertions();

    expect(parseMDXCodeBlocks('```ts\nconst ok = true;\n\n```\n\n```bash\nbun test\n```')).toEqual([
      { language: 'ts', value: 'const ok = true;' },
      { language: 'bash', value: 'bun test' }
    ]);
  });
});
