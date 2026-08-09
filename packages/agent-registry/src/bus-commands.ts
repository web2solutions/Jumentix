/* eslint-disable no-console */
import type {
  AgentBusEvent,
  AgentBusEventKind,
  AgentBusPresence,
  AgentRecord,
  BusStatusResult,
  PublishProgressInput,
  RtdbLike,
  WatchBusInput
} from './types';
import { sanitizeRtdbKey } from './rtdb-client';

const BUS_ROOT = 'agent-bus';
const EVENT_KINDS: AgentBusEventKind[] = [
  'started',
  'progress',
  'blocked',
  'handoff',
  'completed',
  'conflict'
];

function nowIso(): string {
  return new Date().toISOString();
}

function requireNonEmpty(value: string | undefined, field: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`Field "${field}" is required and cannot be empty.`);
  }
  return value.trim();
}

function assertEventKind(kind: string): AgentBusEventKind {
  if (!EVENT_KINDS.includes(kind as AgentBusEventKind)) {
    throw new Error(
      `Field "kind" must be one of: ${EVENT_KINDS.join(', ')}. Got "${kind}".`
    );
  }
  return kind as AgentBusEventKind;
}

function ttlHintIso(ttlDays: number): string {
  const ms = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function isBusEvent(value: unknown): value is AgentBusEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.agentId === 'string'
    && typeof event.taskId === 'string'
    && typeof event.epicId === 'string'
    && typeof event.kind === 'string'
    && typeof event.summary === 'string'
    && typeof event.ts === 'string'
  );
}

function isPresence(value: unknown): value is AgentBusPresence {
  if (!value || typeof value !== 'object') return false;
  const presence = value as Record<string, unknown>;
  return (
    typeof presence.agentId === 'string'
    && typeof presence.status === 'string'
    && typeof presence.epicId === 'string'
    && typeof presence.taskId === 'string'
    && typeof presence.machineId === 'string'
    && typeof presence.updatedAt === 'string'
  );
}

export function presenceFromAgent(
  agent: AgentRecord,
  extras: { branch?: string } = {}
): AgentBusPresence {
  return {
    agentId: agent.agent_id,
    status: agent.status,
    epicId: agent.active_epic,
    taskId: agent.assigned_task,
    branch: extras.branch,
    machineId: agent.machine_id,
    updatedAt: agent.last_heartbeat_utc || nowIso()
  };
}

/**
 * Mirror non-authoritative presence into RTDB.
 * Ownership / assignment remain Firestore SSOT (Requirement 089).
 */
export async function upsertPresence(
  rtdb: RtdbLike,
  presence: AgentBusPresence
): Promise<void> {
  const agentKey = sanitizeRtdbKey(presence.agentId);
  try {
    await rtdb.ref(`${BUS_ROOT}/presence/${agentKey}`).set(presence);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`RTDB presence upsert failed: ${message}`);
  }
}

export async function publishProgress(
  rtdb: RtdbLike,
  input: PublishProgressInput
): Promise<AgentBusEvent & { pushId: string }> {
  const agentId = requireNonEmpty(input.agentId, 'agentId');
  const epicId = requireNonEmpty(input.epicId, 'epicId');
  const taskId = requireNonEmpty(input.taskId, 'taskId');
  const kind = assertEventKind(requireNonEmpty(input.kind, 'kind'));
  const summary = requireNonEmpty(input.summary, 'summary');
  const ts = input.ts || nowIso();
  const ttlDays = input.ttlDays ?? 14;
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    throw new Error('Field "ttlDays" must be a positive number.');
  }

  const event: AgentBusEvent = {
    agentId,
    taskId,
    epicId,
    kind,
    summary,
    refs: input.refs?.map((ref) => ref.trim()).filter(Boolean),
    ts,
    ttlHint: ttlHintIso(ttlDays)
  };

  const epicKey = sanitizeRtdbKey(epicId);
  try {
    const pushRef = rtdb.ref(`${BUS_ROOT}/events/${epicKey}`).push();
    const pushId = pushRef.key;
    if (!pushId) {
      throw new Error('RTDB push did not return a key.');
    }
    await pushRef.set(event);
    console.log(`[agent-bus] published ${kind} for ${agentId} on epic ${epicId}`);
    return { ...event, pushId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`RTDB progress publish failed: ${message}`);
  }
}

/**
 * Subscribe to progress events for an epic. Returns an unsubscribe function.
 */
export function watchBus(rtdb: RtdbLike, input: WatchBusInput): () => void {
  const epicId = requireNonEmpty(input.epicId, 'epicId');
  const epicKey = sanitizeRtdbKey(epicId);
  const sinceMs = input.since ? Date.parse(input.since) : Number.NaN;
  const ref = rtdb.ref(`${BUS_ROOT}/events/${epicKey}`);

  const handler = (snapshot: { key: string | null; val(): unknown }) => {
    const value = snapshot.val();
    if (!isBusEvent(value)) return;
    if (!Number.isNaN(sinceMs) && Date.parse(value.ts) < sinceMs) return;
    input.onEvent(value, snapshot.key || 'unknown');
  };

  ref.on('child_added', handler);
  console.log(`[agent-bus] watching epic ${epicId}`);
  return () => {
    ref.off('child_added', handler);
  };
}

export async function busStatus(
  rtdb: RtdbLike,
  epicIdRaw: string,
  options: { recentLimit?: number } = {}
): Promise<BusStatusResult> {
  const epicId = requireNonEmpty(epicIdRaw, 'epicId');
  const epicKey = sanitizeRtdbKey(epicId);
  const recentLimit = options.recentLimit ?? 50;

  try {
    const presenceSnap = await rtdb.ref(`${BUS_ROOT}/presence`).once('value');
    const presence: AgentBusPresence[] = [];
    presenceSnap.forEach((child) => {
      const value = child.val();
      if (isPresence(value) && sanitizeRtdbKey(value.epicId) === epicKey) {
        presence.push(value);
      }
      return false;
    });

    const eventsSnap = await rtdb
      .ref(`${BUS_ROOT}/events/${epicKey}`)
      .orderByChild('ts')
      .limitToLast(recentLimit)
      .once('value');

    const recentEvents: Array<AgentBusEvent & { pushId: string }> = [];
    eventsSnap.forEach((child) => {
      const value = child.val();
      if (isBusEvent(value)) {
        recentEvents.push({ ...value, pushId: child.key || 'unknown' });
      }
      return false;
    });
    recentEvents.sort((left, right) => left.ts.localeCompare(right.ts));

    return { epicId, presence, recentEvents };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`RTDB bus status failed: ${message}`);
  }
}

export { EVENT_KINDS };
