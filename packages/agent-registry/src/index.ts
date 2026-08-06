export type {
  AgentRecord,
  AgentRegistrySnapshot,
  AgentStatus,
  AssignTaskInput,
  CompleteTaskInput,
  FirestoreLike,
  HeartbeatInput,
  RegisterAgentInput
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
  registerAgent,
  heartbeat,
  assignTask,
  completeTask,
  repairRegistry,
  syncSnapshot,
  checkSnapshot
} from './commands';

export {
  AGENT_STATUSES,
  assertValidAgentRecord,
  canonicalAgentId,
  describeProblems,
  documentIdProblem,
  duplicateCanonicalIds,
  findIntegrityProblems,
  isAgentStatus
} from './validation';
