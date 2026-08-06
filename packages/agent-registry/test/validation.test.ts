import {
  AGENT_STATUSES,
  assertValidAgentRecord,
  canonicalAgentId,
  describeProblems,
  documentIdProblem,
  duplicateCanonicalIds,
  findIntegrityProblems,
  isAgentStatus
} from '../src';
import type { AgentRecord } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * These rules exist because ten of twelve documents in the live collection were
 * written with markdown formatting inside the data, and nothing objected
 * (JUM-613). So the cases below are not hypothetical: each one is a shape that
 * actually reached Firestore, or a Firestore constraint that `.doc()` enforces
 * only once the write is already in flight.
 */

function buildAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    agent_id: 'test-agent-001',
    agent_name: 'Test Agent',
    platform: 'Test Platform',
    machine_id: 'machine-001',
    machine_name: 'test-machine',
    machine_os: 'Darwin 25.5.0 arm64',
    workspace_path: '/tmp/test-workspace',
    agent_runtime: 'test-runtime',
    agent_version: '1.0.0',
    status: 'available',
    registered_at_utc: '2026-01-01T00:00:00.000Z',
    last_heartbeat_utc: '2026-01-01T00:00:00.000Z',
    last_branch_check_utc: '2026-01-01T00:00:00.000Z',
    main_ref_checked: 'abc123',
    dev_ref_checked: 'def456',
    active_epic: 'none',
    assigned_task: 'none',
    capabilities: ['test'],
    ...overrides
  };
}

/** A record shaped exactly like the ones the migration wrote. */
function buildMigratedAgent(): Record<string, unknown> {
  const clean = buildAgent();
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(clean)) {
    wrapped[key] = typeof value === 'string' ? `\`${value}\`` : value;
  }
  return wrapped;
}

describe('canonicalAgentId', () => {
  it('removes the backticks the migration wrapped an id in', () => {
    expect.hasAssertions();

    expect(canonicalAgentId('`claude-governance-001`')).toBe('claude-governance-001');
  });

  it('leaves an already-clean id untouched', () => {
    expect.hasAssertions();

    expect(canonicalAgentId('claude-governance-001')).toBe('claude-governance-001');
  });

  it('removes surrounding whitespace, inside and outside the formatting', () => {
    expect.hasAssertions();

    expect(canonicalAgentId('  ` codex-primary-001 `  ')).toBe('codex-primary-001');
  });

  /**
   * Only the wrapping is formatting. A backtick in the middle of an id is not
   * something to quietly rewrite — it is reported instead, because an id nobody
   * understands must not be silently turned into a different one.
   */
  it('does not strip a backtick from the middle of an id', () => {
    expect.hasAssertions();

    expect(canonicalAgentId('we`ird')).toBe('we`ird');
    expect(documentIdProblem('we`ird')).toMatch(/backticks/);
  });
});

describe('documentIdProblem', () => {
  it('accepts an ordinary agent id', () => {
    expect.hasAssertions();

    expect(documentIdProblem('claude-governance-001')).toBeUndefined();
  });

  it.each([
    ['', /cannot be empty/],
    ['   ', /cannot be empty/],
    [' padded ', /whitespace/],
    ['`backticked`', /backticks/],
    ['.', /cannot be "\." or "\.\."/],
    ['..', /cannot be "\." or "\.\."/],
    ['agents/nested', /cannot contain/],
    ['__reserved__', /reserved/]
  ])('rejects %p', (id, expected) => {
    expect.hasAssertions();

    expect(documentIdProblem(id)).toMatch(expected);
  });

  it('rejects an id past the Firestore byte limit', () => {
    expect.hasAssertions();

    expect(documentIdProblem('a'.repeat(1501))).toMatch(/1500-byte/);
  });

  it('accepts an id exactly at the byte limit', () => {
    expect.hasAssertions();

    expect(documentIdProblem('a'.repeat(1500))).toBeUndefined();
  });

  /**
   * The limit is bytes, not characters. A 1000-character id of two-byte
   * characters is 2000 bytes and Firestore rejects it, which a `.length` check
   * would have let through.
   */
  it('measures the limit in bytes rather than characters', () => {
    expect.hasAssertions();

    expect(documentIdProblem('é'.repeat(800))).toMatch(/1500-byte/);
  });

  it('rejects a value that is not a string at all', () => {
    expect.hasAssertions();

    expect(documentIdProblem(undefined as unknown as string)).toMatch(/cannot be empty/);
  });
});

describe('isAgentStatus', () => {
  it.each(AGENT_STATUSES)('accepts %s', (status) => {
    expect.hasAssertions();

    expect(isAgentStatus(status)).toBe(true);
  });

  /** The exact value every migrated document holds. */
  it('rejects a status wrapped in backticks', () => {
    expect.hasAssertions();

    expect(isAgentStatus('`busy`')).toBe(false);
  });

  it('rejects a non-string', () => {
    expect.hasAssertions();

    expect(isAgentStatus(undefined)).toBe(false);
    expect(isAgentStatus(3)).toBe(false);
  });
});

describe('findIntegrityProblems', () => {
  it('finds nothing wrong with a well-formed record', () => {
    expect.hasAssertions();

    expect(findIntegrityProblems(buildAgent())).toStrictEqual([]);
  });

  /**
   * The regression case. Reported in full rather than one problem at a time:
   * fixing sixteen fields through sixteen round trips against a live collection
   * is not a repair anyone would run.
   */
  it('reports every field a migrated record corrupted at once', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(buildMigratedAgent());
    const fields = problems.map((problem) => problem.field);

    expect(fields).toContain('agent_id');
    expect(fields).toContain('workspace_path');
    expect(fields).toContain('main_ref_checked');
    // Both the formatting and the fact that the value is not in the union.
    expect(problems.filter((problem) => problem.field === 'status')).toHaveLength(2);
    expect(problems.length).toBeGreaterThan(15);
  });

  it('reports the id it found, so a corrupt record can still be named', () => {
    expect.hasAssertions();

    const [first] = findIntegrityProblems(buildMigratedAgent());

    expect(first.agent_id).toBe('`test-agent-001`');
  });

  it('names a record with no id at all rather than crashing on it', () => {
    expect.hasAssertions();

    const record = buildAgent();
    delete (record as Partial<AgentRecord>).agent_id;

    expect(findIntegrityProblems(record)[0]).toStrictEqual({
      agent_id: '(missing)',
      field: 'agent_id',
      problem: 'is required and cannot be empty'
    });
  });

  it.each([
    [null],
    [undefined],
    ['a string'],
    [[]]
  ])('reports %p as not being a document', (value) => {
    expect.hasAssertions();

    expect(findIntegrityProblems(value)).toStrictEqual([
      { agent_id: '(unknown)', field: '(document)', problem: 'is not an object' }
    ]);
  });

  it('reports a required field that is missing', () => {
    expect.hasAssertions();

    const record = buildAgent();
    delete (record as Partial<AgentRecord>).platform;

    expect(findIntegrityProblems(record)).toStrictEqual([
      { agent_id: 'test-agent-001', field: 'platform', problem: 'must be a string, found nothing' }
    ]);
  });

  it('reports a required field of the wrong type', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(buildAgent({ platform: 7 as unknown as string }));

    expect(problems[0].problem).toBe('must be a string, found number');
  });

  it('reports a required field left empty', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(buildAgent({ agent_name: '   ' }));

    expect(problems[0].problem).toBe('is required and cannot be empty');
  });

  /**
   * An agent that has not checked the branches yet genuinely has no ref, and
   * `registerAgent` writes `''` for both. Empty is a fact here, not a gap.
   */
  it('allows the branch refs to be empty', () => {
    expect.hasAssertions();

    const record = buildAgent({ main_ref_checked: '', dev_ref_checked: '' });

    expect(findIntegrityProblems(record)).toStrictEqual([]);
  });

  it('still rejects formatting in an otherwise-optional branch ref', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(buildAgent({ main_ref_checked: '`abc123`' }));

    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe('main_ref_checked');
  });

  it('reports a branch ref of the wrong type', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(
      buildAgent({ dev_ref_checked: 5 as unknown as string })
    );

    expect(problems[0].problem).toBe('must be a string, found number');
  });

  /**
   * Absent is not the same as empty. An empty ref is an agent that has not
   * checked yet; a missing key is a record written by something that does not
   * know the schema.
   */
  it('reports a branch ref that is absent rather than empty', () => {
    expect.hasAssertions();

    const record = buildAgent();
    delete (record as Partial<AgentRecord>).main_ref_checked;

    expect(findIntegrityProblems(record)).toStrictEqual([
      {
        agent_id: 'test-agent-001',
        field: 'main_ref_checked',
        problem: 'must be a string, found nothing'
      }
    ]);
  });

  it('reports a status outside the union', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(buildAgent({ status: 'working' as never }));

    expect(problems[0].problem).toMatch(/must be one of available, busy, blocked, offline/);
  });

  it('reports capabilities that are not an array', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(
      buildAgent({ capabilities: 'one, two' as unknown as string[] })
    );

    expect(problems).toStrictEqual([
      { agent_id: 'test-agent-001', field: 'capabilities', problem: 'must be an array' }
    ]);
  });

  it('reports the position of a bad capability rather than just the field', () => {
    expect.hasAssertions();

    const problems = findIntegrityProblems(
      buildAgent({ capabilities: ['fine', '`formatted`', 9 as unknown as string] })
    );

    expect(problems.map((problem) => problem.field)).toStrictEqual([
      'capabilities[1]',
      'capabilities[2]'
    ]);
  });
});

describe('duplicateCanonicalIds', () => {
  /** The live collection held exactly this pair. */
  it('sees a formatted id and a clean one as the same agent', () => {
    expect.hasAssertions();

    expect(duplicateCanonicalIds([
      '`kimi-code-primary-001`',
      'kimi-code-primary-001',
      'codex-primary-001'
    ])).toStrictEqual(['kimi-code-primary-001']);
  });

  it('finds nothing when every id is distinct', () => {
    expect.hasAssertions();

    expect(duplicateCanonicalIds(['a', 'b', 'c'])).toStrictEqual([]);
  });

  it('reports each duplicated id once, sorted', () => {
    expect.hasAssertions();

    expect(duplicateCanonicalIds(['b', '`b`', 'a', '`a`', ' a '])).toStrictEqual(['a', 'b']);
  });
});

describe('assertValidAgentRecord', () => {
  it('passes a well-formed record through', () => {
    expect.hasAssertions();

    expect(() => assertValidAgentRecord(buildAgent())).not.toThrow();
  });

  it('refuses a record the migration would have written', () => {
    expect.hasAssertions();

    expect(() => assertValidAgentRecord(buildMigratedAgent()))
      .toThrow(/Refusing to write an invalid agent registry record/);
  });

  it('names the offending fields in the failure', () => {
    expect.hasAssertions();

    expect(() => assertValidAgentRecord(buildAgent({ agent_name: '' })))
      .toThrow(/agent_name is required and cannot be empty/);
  });
});

describe('describeProblems', () => {
  it('renders one indented line per problem', () => {
    expect.hasAssertions();

    expect(describeProblems([
      { agent_id: 'a', field: 'status', problem: 'is wrong' },
      { agent_id: 'b', field: 'platform', problem: 'is missing' }
    ])).toBe('  a — status is wrong\n  b — platform is missing');
  });

  it('renders an empty list as an empty string', () => {
    expect.hasAssertions();

    expect(describeProblems([])).toBe('');
  });
});
