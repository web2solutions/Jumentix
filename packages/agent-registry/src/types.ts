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
}

export interface QueryDocumentSnapshot<T> {
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
