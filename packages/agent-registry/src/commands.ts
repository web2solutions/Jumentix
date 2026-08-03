/* eslint-disable no-console, camelcase */
import fs from 'node:fs';
import path from 'node:path';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  AgentRecord,
  AgentRegistrySnapshot,
  AgentStatus,
  AssignTaskInput,
  CompleteTaskInput,
  HeartbeatInput,
  RegisterAgentInput
} from './types';
import { getAgent, upsertAgent, generateSnapshot } from './firestore-client';

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
  firestore: Firestore,
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

export async function heartbeat(firestore: Firestore, input: HeartbeatInput): Promise<AgentRecord> {
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
  firestore: Firestore,
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
  firestore: Firestore,
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

export async function syncSnapshot(firestore: Firestore): Promise<AgentRegistrySnapshot> {
  const snapshot = await generateSnapshot(firestore);
  const dir = path.dirname(snapshotPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(snapshotPath(), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[agent-registry] snapshot written to ${snapshotPath()} (${snapshot.agents.length} agents)`);
  return snapshot;
}

export async function checkSnapshot(firestore: Firestore): Promise<void> {
  if (!fs.existsSync(snapshotPath())) {
    throw new Error(
      `Local agent registry snapshot not found: ${snapshotPath()}\n`
      + 'Run: bun run agent-registry:sync'
    );
  }

  const local = JSON.parse(fs.readFileSync(snapshotPath(), 'utf8')) as AgentRegistrySnapshot;
  const remote = await generateSnapshot(firestore);

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
