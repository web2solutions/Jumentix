/* eslint-disable no-console */
import {
  initializeApp,
  cert,
  getApps,
  deleteApp
} from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  loadServiceAccount,
  resolveDatabaseUrl
} from './firebase-credentials';
import type { AgentRecord, AgentRegistrySnapshot, FirestoreLike } from './types';
import { assertValidAgentRecord, findIntegrityProblems } from './validation';
import type { IntegrityProblem } from './validation';

const COLLECTION = 'agents';

export function createFirestoreClient(): FirestoreLike {
  if (getApps().length > 0) {
    return getFirestore() as unknown as FirestoreLike;
  }

  const serviceAccount = loadServiceAccount();
  // Attach the RTDB URL (explicit or project_id-derived) so createRtdbClient()
  // can reuse this Admin app — same Firebase project as Firestore (089 / 129).
  const databaseURL = resolveDatabaseUrl(serviceAccount);
  initializeApp({
    credential: cert({
      projectId: String(serviceAccount.project_id),
      privateKey: String(serviceAccount.private_key).replace(/\\n/g, '\n'),
      clientEmail: String(serviceAccount.client_email)
    }),
    databaseURL
  });
  return getFirestore() as unknown as FirestoreLike;
}

export async function getAgent(
  firestore: FirestoreLike,
  agentId: string
): Promise<AgentRecord | null> {
  const doc = await firestore.collection(COLLECTION).doc(agentId).get();
  if (!doc.exists) return null;
  return doc.data() as AgentRecord;
}

/**
 * The write boundary (JUM-613).
 *
 * Validated before the write, not after: the point is that nothing invalid
 * reaches storage. The migration that corrupted ten documents would have
 * failed here on its first record.
 */
export async function upsertAgent(firestore: FirestoreLike, agent: AgentRecord): Promise<void> {
  // Exemptions honoured here (JUM-614). This is the storage primitive: repair,
  // heartbeat, assign and complete all round-trip an existing record through
  // it, and an exempt agent's stored placeholder must survive that round trip.
  // The rule that an agent must *declare* where it works is enforced at the
  // front door, in `registerAgent`, where a fresh declaration is actually made.
  assertValidAgentRecord(agent, { honourExemptions: true });
  await firestore.collection(COLLECTION).doc(agent.agent_id).set(agent, { merge: true });
}

export async function deleteAgent(firestore: FirestoreLike, agentId: string): Promise<void> {
  await firestore.collection(COLLECTION).doc(agentId).delete();
}

/** A stored document together with the id it is actually filed under. */
export interface StoredAgent {
  /** The Firestore document id, which may disagree with `record.agent_id`. */
  documentId: string;
  record: AgentRecord;
  problems: IntegrityProblem[];
}

/**
 * Every document in the collection, with its integrity assessed.
 *
 * Reading deliberately does not throw. The collection holds records that fail
 * the rules today, and refusing to read it would make the repair that fixes
 * them impossible to run — a gate that blocks its own remedy.
 */
export async function getStoredAgents(firestore: FirestoreLike): Promise<StoredAgent[]> {
  const snapshot = await firestore.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => {
    const record = doc.data() as AgentRecord;
    // Exemptions honoured on read: the records they cover already exist, and
    // only each agent's own operator can replace them (JUM-614).
    return {
      documentId: doc.id,
      record,
      problems: findIntegrityProblems(record, { honourExemptions: true })
    };
  });
}

export async function getAllAgents(firestore: FirestoreLike): Promise<AgentRecord[]> {
  const stored = await getStoredAgents(firestore);
  return stored.map((entry) => entry.record);
}

export async function generateSnapshot(firestore: FirestoreLike): Promise<AgentRegistrySnapshot> {
  const agents = await getAllAgents(firestore);
  return {
    agents,
    generated_at_utc: new Date().toISOString(),
    source: 'firestore'
  };
}

export async function closeFirestore(): Promise<void> {
  const apps = getApps() as unknown[];
  await Promise.all(apps.map((app) => deleteApp(app as Parameters<typeof deleteApp>[0])));
}
