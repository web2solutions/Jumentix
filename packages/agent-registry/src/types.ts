/**
 * Agent Registry Firestore schema and types.
 *
 * Collection: agents/{agent_id}
 */

export type AgentStatus = 'available' | 'busy' | 'blocked' | 'offline';

export interface AgentRecord {
  agent_id: string;
  agent_name: string;
  platform: string;
  machine_id: string;
  machine_name: string;
  machine_os: string;
  workspace_path: string;
  agent_runtime: string;
  agent_version: string;
  status: AgentStatus;
  registered_at_utc: string;
  last_heartbeat_utc: string;
  last_branch_check_utc: string;
  main_ref_checked: string;
  dev_ref_checked: string;
  active_epic: string;
  assigned_task: string;
  capabilities: string[];
}

export interface AgentRegistrySnapshot {
  agents: AgentRecord[];
  generated_at_utc: string;
  source: 'firestore';
}

export interface RegisterAgentInput {
  agent_id: string;
  agent_name: string;
  platform: string;
  machine_id: string;
  machine_name: string;
  machine_os: string;
  workspace_path: string;
  agent_runtime: string;
  agent_version: string;
  capabilities?: string[];
}

export interface HeartbeatInput {
  agent_id: string;
  status?: AgentStatus;
  main_ref_checked?: string;
  dev_ref_checked?: string;
}

export interface AssignTaskInput {
  agent_id: string;
  assigned_task: string;
  active_epic: string;
}

export interface CompleteTaskInput {
  agent_id: string;
  status?: AgentStatus;
}

export interface DocumentSnapshot<T> {
  exists: boolean;
  data(): T | undefined;
}

export interface DocumentReference<T> {
  get(): Promise<DocumentSnapshot<T>>;
  set(data: T, options?: { merge?: boolean }): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface QueryDocumentSnapshot<T> {
  /**
   * The document id, which is not the same thing as `data().agent_id`.
   *
   * They disagreed for every record the JUM-611 migration wrote, and reading
   * only the field made the corrupt ids invisible to the snapshot (JUM-613).
   */
  id: string;
  data(): T;
}

export interface QuerySnapshot<T> {
  docs: Array<QueryDocumentSnapshot<T>>;
}

export interface CollectionReference<T> {
  doc(id: string): DocumentReference<T>;
  get(): Promise<QuerySnapshot<T>>;
}

export interface FirestoreLike {
  collection(name: string): CollectionReference<AgentRecord>;
}

/** Progress kinds published on the Firebase RTDB agent bus (Requirement 129). */
export type AgentBusEventKind =
  | 'started'
  | 'progress'
  | 'blocked'
  | 'handoff'
  | 'completed'
  | 'conflict';

export interface AgentBusPresence {
  agentId: string;
  status: AgentStatus;
  epicId: string;
  taskId: string;
  branch?: string;
  machineId: string;
  updatedAt: string;
}

export interface AgentBusEvent {
  agentId: string;
  taskId: string;
  epicId: string;
  kind: AgentBusEventKind;
  summary: string;
  refs?: string[];
  ts: string;
  ttlHint: string;
}

export interface PublishProgressInput {
  agentId: string;
  epicId: string;
  taskId: string;
  kind: AgentBusEventKind;
  summary: string;
  refs?: string[];
  /** ISO timestamp; defaults to now. */
  ts?: string;
  /** Days until suggested retention cleanup; defaults to 14. */
  ttlDays?: number;
}

export interface WatchBusInput {
  epicId: string;
  /** Only emit events with ts >= since (ISO). */
  since?: string;
  /** Called for each event (live + optional backlog). */
  onEvent: (event: AgentBusEvent, pushId: string) => void;
}

export interface BusStatusResult {
  epicId: string;
  presence: AgentBusPresence[];
  recentEvents: Array<AgentBusEvent & { pushId: string }>;
}

export interface RtdbDataSnapshotLike {
  key: string | null;
  val(): unknown;
  forEach(callback: (child: RtdbDataSnapshotLike) => boolean | void): void;
}

export interface RtdbThenableReferenceLike {
  key: string | null;
  set(value: unknown): Promise<void>;
}

export interface RtdbQueryLike {
  once(eventType: 'value'): Promise<RtdbDataSnapshotLike>;
  on(
    eventType: 'child_added',
    callback: (snapshot: RtdbDataSnapshotLike) => void
  ): (snapshot: RtdbDataSnapshotLike) => void;
  off(
    eventType?: 'child_added',
    callback?: (snapshot: RtdbDataSnapshotLike) => void
  ): void;
  limitToLast(limit: number): RtdbQueryLike;
  orderByChild(path: string): RtdbQueryLike;
}

export interface RtdbReferenceLike extends RtdbQueryLike {
  child(path: string): RtdbReferenceLike;
  set(value: unknown): Promise<void>;
  push(value?: unknown): RtdbThenableReferenceLike;
  update(value: Record<string, unknown>): Promise<void>;
}

export interface RtdbLike {
  ref(path?: string): RtdbReferenceLike;
}

export interface RegistryCommandOptions {
  /** When provided, mirror presence / fail closed on RTDB errors (Requirement 129). */
  rtdb?: RtdbLike;
}
