/**
 * Integrity rules for agent registry documents (JUM-613).
 *
 * The JUM-611 migration wrote markdown into Firestore: every value it stored
 * carried the literal backticks that formatted it in `AGENT-REGISTRY.md`,
 * including the field used as the document id. Ten of twelve documents were
 * corrupt, two of them shadow duplicates of documents the CLI later wrote
 * correctly.
 *
 * The migration bug is one line. That it reached storage at all is the defect
 * this module exists for: nothing between the parser and Firestore had an
 * opinion about what a valid record looks like. A `status` typed as a
 * four-value union held `` `busy` ``, because the type is erased at runtime and
 * nothing checked it there.
 *
 * So the rules live here, once, and both boundaries use them:
 *
 *   - **write** rejects, because a bad record must not be stored;
 *   - **read** reports, because a bad record that is already stored must be
 *     visible rather than smoothed over.
 *
 * Read does not throw. Refusing to read the collection would make the repair
 * command that fixes it impossible to run.
 */

import type { AgentRecord, AgentStatus } from './types';

export const AGENT_STATUSES: readonly AgentStatus[] = [
  'available',
  'busy',
  'blocked',
  'offline'
];

/**
 * Fields every document must carry. `capabilities` is validated separately: it
 * is the only non-string field.
 */
const REQUIRED_STRING_FIELDS: ReadonlyArray<keyof AgentRecord> = [
  'agent_id',
  'agent_name',
  'platform',
  'machine_id',
  'machine_name',
  'machine_os',
  'workspace_path',
  'agent_runtime',
  'agent_version',
  'status',
  'registered_at_utc',
  'last_heartbeat_utc',
  'last_branch_check_utc',
  'active_epic',
  'assigned_task'
];

/**
 * Fields allowed to be empty strings.
 *
 * An agent that has not checked the branches yet genuinely has no ref to
 * record, and `registerAgent` writes `''` for both. Empty is a fact here, not a
 * missing value.
 */
const MAY_BE_EMPTY: ReadonlyArray<keyof AgentRecord> = [
  'main_ref_checked',
  'dev_ref_checked'
];

export interface IntegrityProblem {
  /** The document id as stored, so a corrupt id can still be reported. */
  agent_id: string;
  field: string;
  problem: string;
}

/** Markdown formatting that leaked into a stored value. */
function hasMarkdownFormatting(value: string): boolean {
  return value.includes('`');
}

/**
 * What is wrong with one string field, or nothing.
 *
 * `allowEmpty` separates the two cases that look alike: an empty branch ref is
 * an agent that has not checked yet, whereas an empty platform is a record
 * written by something that does not know the schema.
 */
function stringFieldProblem(
  value: unknown,
  { allowEmpty }: { allowEmpty: boolean }
): string | undefined {
  if (typeof value !== 'string') {
    return `must be a string, found ${value === undefined ? 'nothing' : typeof value}`;
  }
  if (!allowEmpty && value.trim() === '') {
    return 'is required and cannot be empty';
  }
  if (hasMarkdownFormatting(value)) {
    return 'contains backticks — markdown formatting leaked into the value';
  }
  return undefined;
}

/**
 * The id a corrupt document should have had.
 *
 * Only formatting is removed — backticks and surrounding whitespace. Anything
 * else about the id is a problem to report, not to rewrite: silently repairing
 * an id nobody understands is how one bad record becomes two.
 */
export function canonicalAgentId(rawAgentId: string): string {
  return String(rawAgentId).trim().replace(/^`+|`+$/g, '').trim();
}

/**
 * Whether a string is usable as a Firestore document id.
 *
 * Firestore's own constraints, which `.doc()` does not check for the caller:
 * an id cannot be empty, cannot be `.` or `..`, cannot contain `/`, cannot
 * match `__.*__`, and is limited to 1500 bytes.
 */
export function documentIdProblem(agentId: string): string | undefined {
  if (typeof agentId !== 'string' || agentId.trim() === '') {
    return 'is required and cannot be empty';
  }
  if (agentId !== agentId.trim()) {
    return 'has leading or trailing whitespace';
  }
  if (hasMarkdownFormatting(agentId)) {
    return 'contains backticks — markdown formatting leaked into the value';
  }
  if (agentId === '.' || agentId === '..') {
    return 'cannot be "." or ".."';
  }
  if (agentId.includes('/')) {
    return 'cannot contain "/" — Firestore reads it as a path separator';
  }
  if (/^__.*__$/.test(agentId)) {
    return 'cannot match the reserved pattern __*__';
  }
  if (Buffer.byteLength(agentId, 'utf8') > 1500) {
    return 'exceeds the 1500-byte Firestore document id limit';
  }
  return undefined;
}

export function isAgentStatus(value: unknown): value is AgentStatus {
  return typeof value === 'string' && (AGENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Every integrity problem in one record.
 *
 * Returns all of them rather than the first. A record written by a broken
 * migration is wrong in sixteen places at once, and fixing them one error
 * message at a time is sixteen round trips against a live collection.
 */
export function findIntegrityProblems(record: unknown): IntegrityProblem[] {
  const problems: IntegrityProblem[] = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return [{ agent_id: '(unknown)', field: '(document)', problem: 'is not an object' }];
  }

  const agent = record as Record<string, unknown>;
  const reportedId = typeof agent.agent_id === 'string' ? agent.agent_id : '(missing)';
  const add = (field: string, problem: string) => {
    problems.push({ agent_id: reportedId, field, problem });
  };

  const idProblem = documentIdProblem(agent.agent_id as string);
  if (idProblem) add('agent_id', idProblem);

  for (const field of REQUIRED_STRING_FIELDS.filter((name) => name !== 'agent_id')) {
    const problem = stringFieldProblem(agent[field], { allowEmpty: false });
    if (problem) add(field, problem);
  }

  for (const field of MAY_BE_EMPTY) {
    const problem = stringFieldProblem(agent[field], { allowEmpty: true });
    if (problem) add(field, problem);
  }

  // Checked after the string rules so a backticked status reports both the
  // formatting and the fact that it is not a member of the union.
  if (typeof agent.status === 'string' && !isAgentStatus(agent.status)) {
    add('status', `must be one of ${AGENT_STATUSES.join(', ')}, found "${agent.status}"`);
  }

  if (!Array.isArray(agent.capabilities)) {
    add('capabilities', 'must be an array');
  } else {
    agent.capabilities.forEach((capability, index) => {
      if (typeof capability !== 'string') {
        add(`capabilities[${index}]`, 'must be a string');
      } else if (hasMarkdownFormatting(capability)) {
        add(`capabilities[${index}]`, 'contains backticks — markdown formatting leaked in');
      }
    });
  }

  return problems;
}

/**
 * Ids that more than one document claims once formatting is discounted.
 *
 * `kimi-code-primary-001` and `` `kimi-code-primary-001` `` are one agent
 * recorded twice, and comparing the raw ids says they are two.
 */
export function duplicateCanonicalIds(agentIds: string[]): string[] {
  const seen = new Map<string, number>();
  for (const id of agentIds) {
    const canonical = canonicalAgentId(id);
    seen.set(canonical, (seen.get(canonical) || 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([canonical]) => canonical)
    .sort();
}

export function describeProblems(problems: IntegrityProblem[]): string {
  return problems
    .map(({ agent_id: id, field, problem }) => `  ${id} — ${field} ${problem}`)
    .join('\n');
}

/**
 * The write boundary. Throws rather than storing a record that fails the rules.
 *
 * This is what was missing when the migration ran.
 */
export function assertValidAgentRecord(record: unknown): asserts record is AgentRecord {
  const problems = findIntegrityProblems(record);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to write an invalid agent registry record:\n${describeProblems(problems)}`
    );
  }
}
