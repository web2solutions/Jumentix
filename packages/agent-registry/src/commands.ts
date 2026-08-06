/* eslint-disable no-console, camelcase */
import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentRecord,
  AgentRegistrySnapshot,
  AgentStatus,
  AssignTaskInput,
  CompleteTaskInput,
  FirestoreLike,
  HeartbeatInput,
  RegisterAgentInput
} from './types';
import {
  getAgent,
  upsertAgent,
  deleteAgent,
  generateSnapshot,
  getStoredAgents
} from './firestore-client';
import {
  canonicalAgentId,
  describeProblems,
  duplicateCanonicalIds,
  findIntegrityProblems,
  isAgentStatus
} from './validation';

function snapshotPath(): string {
  return process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH
    ? path.resolve(process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH)
    : path.resolve('.agents/registry-snapshot.json');
}

function nowIso(): string {
  return new Date().toISOString();
}

function requireNonEmpty(value: string | undefined, field: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`Field "${field}" is required and cannot be empty.`);
  }
  return value.trim();
}

function buildDefaultCapabilities(): string[] {
  return [
    'repository-wide source and documentation assimilation',
    'governed implementation, testing, and CI diagnostics',
    'spec, Linear, and agent-registry traceability'
  ];
}

export async function registerAgent(
  firestore: FirestoreLike,
  input: RegisterAgentInput
): Promise<AgentRecord> {
  const agent_id = requireNonEmpty(input.agent_id, 'agent_id');
  const existing = await getAgent(firestore, agent_id);
  const now = nowIso();

  const agent: AgentRecord = {
    agent_id,
    agent_name: requireNonEmpty(input.agent_name, 'agent_name'),
    platform: requireNonEmpty(input.platform, 'platform'),
    machine_id: requireNonEmpty(input.machine_id, 'machine_id'),
    machine_name: requireNonEmpty(input.machine_name, 'machine_name'),
    machine_os: requireNonEmpty(input.machine_os, 'machine_os'),
    workspace_path: requireNonEmpty(input.workspace_path, 'workspace_path'),
    agent_runtime: requireNonEmpty(input.agent_runtime, 'agent_runtime'),
    agent_version: requireNonEmpty(input.agent_version, 'agent_version'),
    status: existing?.status || 'available',
    registered_at_utc: existing?.registered_at_utc || now,
    last_heartbeat_utc: now,
    last_branch_check_utc: existing?.last_branch_check_utc || now,
    main_ref_checked: existing?.main_ref_checked || '',
    dev_ref_checked: existing?.dev_ref_checked || '',
    active_epic: existing?.active_epic || 'none',
    assigned_task: existing?.assigned_task || 'none',
    capabilities: input.capabilities || existing?.capabilities || buildDefaultCapabilities()
  };

  await upsertAgent(firestore, agent);
  console.log(`[agent-registry] registered ${agent_id} (status=${agent.status})`);
  return agent;
}

export async function heartbeat(
  firestore: FirestoreLike,
  input: HeartbeatInput
): Promise<AgentRecord> {
  const agent_id = requireNonEmpty(input.agent_id, 'agent_id');
  const existing = await getAgent(firestore, agent_id);
  if (!existing) {
    throw new Error(`Agent "${agent_id}" is not registered. Run agent-registry:register first.`);
  }

  const now = nowIso();
  const agent: AgentRecord = {
    ...existing,
    status: input.status || existing.status,
    last_heartbeat_utc: now,
    last_branch_check_utc: now,
    main_ref_checked: input.main_ref_checked || existing.main_ref_checked,
    dev_ref_checked: input.dev_ref_checked || existing.dev_ref_checked
  };

  await upsertAgent(firestore, agent);
  console.log(`[agent-registry] heartbeat ${agent_id} (status=${agent.status})`);
  return agent;
}

export async function assignTask(
  firestore: FirestoreLike,
  input: AssignTaskInput
): Promise<AgentRecord> {
  const agent_id = requireNonEmpty(input.agent_id, 'agent_id');
  const existing = await getAgent(firestore, agent_id);
  if (!existing) {
    throw new Error(`Agent "${agent_id}" is not registered. Run agent-registry:register first.`);
  }

  const agent: AgentRecord = {
    ...existing,
    assigned_task: requireNonEmpty(input.assigned_task, 'assigned_task'),
    active_epic: requireNonEmpty(input.active_epic, 'active_epic'),
    status: 'busy',
    last_heartbeat_utc: nowIso()
  };

  await upsertAgent(firestore, agent);
  console.log(`[agent-registry] assigned ${agent_id} to ${input.assigned_task}`);
  return agent;
}

export async function completeTask(
  firestore: FirestoreLike,
  input: CompleteTaskInput
): Promise<AgentRecord> {
  const agent_id = requireNonEmpty(input.agent_id, 'agent_id');
  const existing = await getAgent(firestore, agent_id);
  if (!existing) {
    throw new Error(`Agent "${agent_id}" is not registered. Run agent-registry:register first.`);
  }

  const status: AgentStatus = input.status || 'available';
  const agent: AgentRecord = {
    ...existing,
    assigned_task: 'none',
    active_epic: 'none',
    status,
    last_heartbeat_utc: nowIso()
  };

  await upsertAgent(firestore, agent);
  console.log(`[agent-registry] completed task for ${agent_id} (status=${status})`);
  return agent;
}

/**
 * Strips markdown formatting from a stored value without changing its meaning.
 *
 * Every backtick, not only the wrapping pair. Some records carry a whole
 * sentence with inline code spans in the middle — one live `active_epic` read
 * "none (Cana epic closed: ... cf6098b)" with each of those three fragments
 * individually wrapped — and removing only the outer pair leaves formatting
 * behind. Taking them all out drops no words.
 *
 * Ids are deliberately not cleaned this way. `canonicalAgentId` removes only
 * the wrapping pair, because an id with a backtick in the middle is an identity
 * nobody can vouch for, and quietly renaming it would invent an agent.
 */
function cleanValue(value: unknown): string {
  return typeof value === 'string' ? value.replace(/`/g, '').trim() : '';
}

export interface RepairAction {
  documentId: string;
  canonicalId: string;
  /** `rewrite` when the id was already right, `merge` when a document moves. */
  kind: 'rewrite' | 'merge';
  /** Set when repairing this document also removes the one it came from. */
  deletes?: string;
  fieldsCleaned: string[];
}

export interface RepairResult {
  actions: RepairAction[];
  applied: boolean;
}

/**
 * Repairs the records the JUM-611 migration corrupted (JUM-613).
 *
 * Formatting is removed and the document is refiled under its canonical id.
 * Where a corrupt document and a clean one describe the same agent, the clean
 * one wins on every field it holds: it was written later, by the CLI, from a
 * live agent, whereas the corrupt one is a snapshot of a markdown file from
 * July. The corrupt document is then deleted.
 *
 * Values are cleaned, never invented. `workspace_path: "unknown"` stays
 * `unknown` — that is a Requirement 114 gap belonging to the agent that owns
 * the record, and quietly filling it in would hide the gap rather than close
 * it.
 *
 * Dry run by default. `apply` is the caller's explicit decision, because the
 * repair deletes documents that belong to other agents.
 */
export async function repairRegistry(
  firestore: FirestoreLike,
  options: { apply?: boolean } = {}
): Promise<RepairResult> {
  const apply = options.apply === true;
  const stored = await getStoredAgents(firestore);

  const healthyByCanonical = new Map<string, AgentRecord>();
  for (const entry of stored) {
    if (entry.problems.length === 0) {
      healthyByCanonical.set(canonicalAgentId(entry.record.agent_id), entry.record);
    }
  }

  const actions: RepairAction[] = [];

  for (const entry of stored.filter((candidate) => candidate.problems.length > 0)) {
    const canonicalId = canonicalAgentId(entry.record.agent_id)
      || canonicalAgentId(entry.documentId);
    if (!canonicalId) {
      throw new Error(
        `Document "${entry.documentId}" has no recoverable agent id. `
        + 'Repair it by hand rather than guessing at an identity.'
      );
    }

    const cleaned: Record<string, unknown> = {};
    const fieldsCleaned: string[] = [];
    const scalarFields = Object.entries(entry.record).filter(([key]) => key !== 'capabilities');
    for (const [key, value] of scalarFields) {
      const clean = cleanValue(value);
      cleaned[key] = clean;
      if (clean !== value) fieldsCleaned.push(key);
    }
    cleaned.agent_id = canonicalId;
    cleaned.capabilities = Array.isArray(entry.record.capabilities)
      ? entry.record.capabilities.map((capability) => cleanValue(capability)).filter(Boolean)
      : [];

    // A status that survives cleaning but is still not a member of the union
    // is not something to guess at.
    if (!isAgentStatus(cleaned.status)) {
      throw new Error(
        `Document "${entry.documentId}" holds an unrecognised status "${String(cleaned.status)}". `
        + 'Set it by hand rather than guessing at it.'
      );
    }

    // The clean twin wins where one exists: it is the newer, live record.
    const healthy = healthyByCanonical.get(canonicalId);
    const candidate: Record<string, unknown> = healthy ? { ...cleaned, ...healthy } : cleaned;

    // Cast through `unknown` because `candidate` is assembled field by field
    // from a document that failed the rules. The validation below is what makes
    // it an AgentRecord; the cast only tells the compiler so.
    const record = candidate as unknown as AgentRecord;

    const problems = findIntegrityProblems(record);
    if (problems.length > 0) {
      throw new Error(
        `Repairing "${entry.documentId}" does not produce a valid record:\n`
        + `${describeProblems(problems)}\n`
        + 'Fix it by hand rather than writing it back broken.'
      );
    }

    const moves = entry.documentId !== canonicalId;
    actions.push({
      documentId: entry.documentId,
      canonicalId,
      kind: moves ? 'merge' : 'rewrite',
      deletes: moves ? entry.documentId : undefined,
      fieldsCleaned
    });

    if (apply) {
      // Sequential on purpose. Each document is written and only then is its
      // corrupt twin removed; running the collection in parallel would let a
      // failure land after some deletes had already happened, and the point of
      // a repair is that it stops at the first thing it does not understand.
      /* eslint-disable no-await-in-loop */
      await upsertAgent(firestore, record);
      if (moves) await deleteAgent(firestore, entry.documentId);
      /* eslint-enable no-await-in-loop */
    }
  }

  const verb = apply ? 'repaired' : 'would repair';
  console.log(`[agent-registry] ${verb} ${actions.length} document(s)`);
  for (const action of actions) {
    const suffix = action.deletes
      ? ` (merged into "${action.canonicalId}", removing the old id)`
      : '';
    const cleaned = action.fieldsCleaned.join(', ') || '(no string fields changed)';
    console.log(`  ${action.documentId} -> ${action.canonicalId}${suffix}`);
    console.log(`    cleaned: ${cleaned}`);
  }
  if (!apply && actions.length > 0) {
    console.log('\nThis was a dry run. Re-run with --apply to write the changes.');
  }

  return { actions, applied: apply };
}

export async function syncSnapshot(firestore: FirestoreLike): Promise<AgentRegistrySnapshot> {
  const snapshot = await generateSnapshot(firestore);
  const dir = path.dirname(snapshotPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(snapshotPath(), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[agent-registry] snapshot written to ${snapshotPath()} (${snapshot.agents.length} agents)`);
  return snapshot;
}

export async function checkSnapshot(firestore: FirestoreLike): Promise<void> {
  if (!fs.existsSync(snapshotPath())) {
    throw new Error(
      `Local agent registry snapshot not found: ${snapshotPath()}\n`
      + 'Run: bun run agent-registry:sync'
    );
  }

  const local = JSON.parse(fs.readFileSync(snapshotPath(), 'utf8')) as AgentRegistrySnapshot;
  const remote = await generateSnapshot(firestore);

  // Integrity first (JUM-613). This check used to key both sides by
  // `agent_id`, so a corrupt document and its clean twin were two unrelated
  // keys that both matched — the gate reported success over ten broken
  // records. Comparing sides is only meaningful once each side is sound.
  const corrupt = remote.agents.flatMap((agent) => findIntegrityProblems(agent));
  if (corrupt.length > 0) {
    throw new Error(
      `Firestore holds ${corrupt.length} integrity problem(s):\n${describeProblems(corrupt)}\n`
      + 'Run: bun run agent-registry:repair'
    );
  }

  const duplicates = duplicateCanonicalIds(remote.agents.map((agent) => agent.agent_id));
  if (duplicates.length > 0) {
    throw new Error(
      `Firestore holds more than one document per agent: ${duplicates.join(', ')}\n`
      + 'Run: bun run agent-registry:repair'
    );
  }

  const localMap = new Map(local.agents.map((a) => [a.agent_id, a]));
  const remoteMap = new Map(remote.agents.map((a) => [a.agent_id, a]));

  const missingInLocal: string[] = [];
  const missingInRemote: string[] = [];
  const staleAgents: string[] = [];

  for (const [id] of remoteMap) {
    if (!localMap.has(id)) missingInLocal.push(id);
  }
  for (const [id] of localMap) {
    if (!remoteMap.has(id)) missingInRemote.push(id);
  }

  for (const [id, remoteAgent] of remoteMap) {
    const localAgent = localMap.get(id);
    if (localAgent && JSON.stringify(localAgent) !== JSON.stringify(remoteAgent)) {
      staleAgents.push(id);
    }
  }

  if (missingInLocal.length > 0 || missingInRemote.length > 0 || staleAgents.length > 0) {
    const parts: string[] = ['Agent registry snapshot is out of sync with Firestore.'];
    if (missingInLocal.length > 0) parts.push(`Missing in local: ${missingInLocal.join(', ')}`);
    if (missingInRemote.length > 0) parts.push(`Missing in Firestore: ${missingInRemote.join(', ')}`);
    if (staleAgents.length > 0) parts.push(`Stale agents: ${staleAgents.join(', ')}`);
    parts.push('Run: bun run agent-registry:sync');
    throw new Error(parts.join('\n'));
  }

  console.log(`[agent-registry] snapshot matches Firestore (${remote.agents.length} agents).`);
}
