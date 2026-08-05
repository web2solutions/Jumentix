/* eslint-disable @typescript-eslint/no-var-requires */

const {
  parseMarkdownRegistry,
  unformat
} = require('../../../../../ci-cd/migrate-agent-registry-to-firestore') as {
  parseMarkdownRegistry: (content: string) => Array<Record<string, unknown>>;
  unformat: (value: unknown) => string;
};

/**
 * The parser that corrupted the live registry (JUM-613).
 *
 * It stripped the backticks around each markdown *key* and kept the ones around
 * each *value*, so every record it wrote carried markdown into Firestore —
 * including the field used as the document id. Ten of twelve documents were
 * affected, and a `status` typed as a four-value union ended up holding
 * `` `busy` ``.
 *
 * It had no test. It could not have had one: the module ran its migration at
 * import time, so requiring it meant running it. Both are fixed here.
 */

const REGISTRY = `# Agent Registry

### 1) codex-primary-001

- \`agent_id\`: \`codex-primary-001\`
- \`agent_name\`: \`Codex Primary\`
- \`platform\`: \`Codex\`
- \`machine_id\`: \`host-mac-pro\`
- \`machine_name\`: \`Eduardos-Mac-Pro.local\`
- \`machine_os\`: \`Darwin 21.6.0 x86_64\`
- \`workspace_path\`: \`/Users/e/apps/XpertMinds/codex-primary-001\`
- \`agent_runtime\`: \`Codex CLI\`
- \`agent_version\`: \`1.0.0\`
- \`status\`: \`busy\`
- \`main_ref_checked\`: \`abc1234\`
- \`capabilities\`:
  - governance delivery
  - CI gate repair

### 2) kimi-code-primary-001

- \`agent_id\`: \`kimi-code-primary-001\`
- \`status\`: \`available\`
`;

describe('unformat', () => {
  it('removes the backticks that formatted a value', () => {
    expect.hasAssertions();

    expect(unformat('`busy`')).toBe('busy');
  });

  it('leaves an unformatted value alone', () => {
    expect.hasAssertions();

    expect(unformat('busy')).toBe('busy');
  });

  it('removes whitespace inside and outside the formatting', () => {
    expect.hasAssertions();

    expect(unformat('  ` busy `  ')).toBe('busy');
  });

  it('coerces a non-string rather than throwing on it', () => {
    expect.hasAssertions();

    expect(unformat(42)).toBe('42');
  });
});

describe('parseMarkdownRegistry', () => {
  it('finds every agent in the document', () => {
    expect.hasAssertions();

    expect(parseMarkdownRegistry(REGISTRY)).toHaveLength(2);
  });

  /**
   * The regression. Every one of these values used to arrive with its
   * backticks attached, and `agent_id` became the Firestore document id.
   */
  it('stores values without the markdown that formatted them', () => {
    expect.hasAssertions();

    const [agent] = parseMarkdownRegistry(REGISTRY);

    expect(agent.agent_id).toBe('codex-primary-001');
    expect(agent.status).toBe('busy');
    expect(agent.workspace_path).toBe('/Users/e/apps/XpertMinds/codex-primary-001');
    expect(agent.machine_os).toBe('Darwin 21.6.0 x86_64');
  });

  it('leaves no backtick anywhere in a parsed record', () => {
    expect.hasAssertions();

    const values = parseMarkdownRegistry(REGISTRY)
      .flatMap((agent) => Object.values(agent))
      .flat()
      .filter((value) => typeof value === 'string');

    expect(values.every((value) => !(value as string).includes('`'))).toBe(true);
  });

  it('reads the id from the section header too', () => {
    expect.hasAssertions();

    // The header is the id's other source. It used to be parsed cleanly and
    // then overwritten by the backticked field below it.
    const withoutField = REGISTRY.replace(/- `agent_id`: `codex-primary-001`\n/, '');

    expect(parseMarkdownRegistry(withoutField)[0].agent_id).toBe('codex-primary-001');
  });

  it('collects the nested capability list without its formatting', () => {
    expect.hasAssertions();

    expect(parseMarkdownRegistry(REGISTRY)[0].capabilities).toStrictEqual([
      'governance delivery',
      'CI gate repair'
    ]);
  });

  it('gives an agent that declares no capabilities an empty list', () => {
    expect.hasAssertions();

    expect(parseMarkdownRegistry(REGISTRY)[1].capabilities).toStrictEqual([]);
  });

  it('ignores fields the schema does not declare', () => {
    expect.hasAssertions();

    const withExtra = REGISTRY.replace(
      '- `status`: `busy`',
      '- `status`: `busy`\n- `favourite_colour`: `blue`'
    );

    expect(parseMarkdownRegistry(withExtra)[0].favourite_colour).toBeUndefined();
  });

  it('returns nothing for a document with no agent sections', () => {
    expect.hasAssertions();

    expect(parseMarkdownRegistry('# Heading\n\nSome prose.\n')).toStrictEqual([]);
  });
});
