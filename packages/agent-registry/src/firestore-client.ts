/* eslint-disable no-console */
import {
  initializeApp,
  cert,
  getApps,
  deleteApp
} from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import type { AgentRecord, AgentRegistrySnapshot } from './types';

const COLLECTION = 'agents';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseServiceAccount(): Record<string, unknown> {
  const raw = requiredEnv('FIREBASE_SERVICE_ACCOUNT_KEY');
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error('Invalid service account structure');
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

export function createFirestoreClient(): Firestore {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const serviceAccount = parseServiceAccount();
  initializeApp({
    credential: cert({
      projectId: String(serviceAccount.project_id),
      privateKey: String(serviceAccount.private_key).replace(/\\n/g, '\n'),
      clientEmail: String(serviceAccount.client_email)
    })
  });
  return getFirestore();
}

export async function getAgent(firestore: Firestore, agentId: string): Promise<AgentRecord | null> {
  const doc = await firestore.collection(COLLECTION).doc(agentId).get();
  if (!doc.exists) return null;
  return doc.data() as AgentRecord;
}

export async function upsertAgent(firestore: Firestore, agent: AgentRecord): Promise<void> {
  await firestore.collection(COLLECTION).doc(agent.agent_id).set(agent, { merge: true });
}

export async function getAllAgents(firestore: Firestore): Promise<AgentRecord[]> {
  const snapshot = await firestore.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => doc.data() as AgentRecord);
}

export async function generateSnapshot(firestore: Firestore): Promise<AgentRegistrySnapshot> {
  const agents = await getAllAgents(firestore);
  return {
    agents,
    generated_at_utc: new Date().toISOString(),
    source: 'firestore'
  };
}

export async function closeFirestore(): Promise<void> {
  const apps = getApps();
  await Promise.all(apps.map((app) => deleteApp(app)));
}
