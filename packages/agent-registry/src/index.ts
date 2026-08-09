export type {
  AgentRecord,
  AgentRegistrySnapshot,
  AgentStatus,
  AgentBusEvent,
  AgentBusEventKind,
  AgentBusPresence,
  AssignTaskInput,
  BusStatusResult,
  CompleteTaskInput,
  FirestoreLike,
  HeartbeatInput,
  PublishProgressInput,
  RegisterAgentInput,
  RegistryCommandOptions,
  RtdbLike,
  WatchBusInput
} from './types';

export type { StoredAgent } from './firestore-client';
export type { RepairAction, RepairResult } from './commands';
export type { IntegrityProblem } from './validation';

export {
  createFirestoreClient,
  getAgent,
  upsertAgent,
  deleteAgent,
  getAllAgents,
  getStoredAgents,
  generateSnapshot,
  closeFirestore
} from './firestore-client';

export {
  createRtdbClient,
  closeRtdb,
  sanitizeRtdbKey
} from './rtdb-client';

export {
  publishProgress,
  watchBus,
  busStatus,
  upsertPresence,
  presenceFromAgent,
  EVENT_KINDS
} from './bus-commands';

export {
  registerAgent,
  heartbeat,
  assignTask,
  completeTask,
  repairRegistry,
  syncSnapshot,
  checkSnapshot
} from './commands';

export type { WorkspaceExemption } from './validation';

export {
  AGENT_STATUSES,
  AGENTS_WITHOUT_DECLARED_WORKSPACE,
  assertValidAgentRecord,
  canonicalAgentId,
  describeProblems,
  documentIdProblem,
  duplicateCanonicalIds,
  findIntegrityProblems,
  isAgentStatus,
  workspacePathProblem
} from './validation';
