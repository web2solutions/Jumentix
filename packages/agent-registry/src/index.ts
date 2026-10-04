export type {
  AgentBusEvent,
  AgentBusEventKind,
  AgentBusPresence,
  AgentRecord,
  AgentRegistrySnapshot,
  AgentStatus,
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
  closeFirestore,
  createFirestoreClient,
  deleteAgent,
  generateSnapshot,
  getAgent,
  getAllAgents,
  getStoredAgents,
  upsertAgent
} from './firestore-client';

export { closeRtdb, createRtdbClient, sanitizeRtdbKey } from './rtdb-client';

export {
  defaultDatabaseUrl,
  hasFirebaseCredentials,
  loadServiceAccount,
  normalizeDatabaseUrl,
  resolveDatabaseUrl
} from './firebase-credentials';

export {
  busStatus,
  EVENT_KINDS,
  presenceFromAgent,
  publishProgress,
  upsertPresence,
  watchBus
} from './bus-commands';

export {
  assignTask,
  checkSnapshot,
  completeTask,
  heartbeat,
  registerAgent,
  repairRegistry,
  syncSnapshot
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
