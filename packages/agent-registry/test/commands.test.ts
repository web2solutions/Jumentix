/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  registerAgent,
  heartbeat,
  assignTask,
  completeTask,
  syncSnapshot,
  checkSnapshot
} from '../src/commands';
import type { AgentRecord } from '../src/types';

const mockFirestore = {
  agents: new Map<string, AgentRecord>(),
  collection: () => ({
    doc: (id: string) => ({
      get: async () => ({
        exists: mockFirestore.agents.has(id),
        data: () => mockFirestore.agents.get(id)
      }),
      set: async (data: AgentRecord) => {
        mockFirestore.agents.set(id, data);
      }
    }),
    get: async () => ({
      docs: Array.from(mockFirestore.agents.values()).map((agent) => ({
        data: () => agent
      }))
    })
  })
} as any;

function clearAgents() {
  mockFirestore.agents.clear();
}

function seedAgent(agent: AgentRecord) {
  mockFirestore.agents.set(agent.agent_id, agent);
}

function buildAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    agent_id: 'test-agent-001',
    agent_name: 'Test Agent',
    platform: 'Test Platform',
    machine_id: 'machine-001',
    machine_name: 'test-machine',
    machine_os: 'Darwin 25.5.0 arm64',
    workspace_path: '/tmp/test-workspace',
    agent_runtime: 'test-runtime',
    agent_version: '1.0.0',
    status: 'available',
    registered_at_utc: '2026-01-01T00:00:00.000Z',
    last_heartbeat_utc: '2026-01-01T00:00:00.000Z',
    last_branch_check_utc: '2026-01-01T00:00:00.000Z',
    main_ref_checked: 'abc123',
    dev_ref_checked: 'def456',
    active_epic: 'none',
    assigned_task: 'none',
    capabilities: ['test'],
    ...overrides
  };
}

function snapshotPath() {
  return process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH
    ? path.resolve(process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH)
    : path.resolve('.agents/registry-snapshot.json');
}

describe('agent-registry commands', () => {
  let snapshotDir: string;

  beforeEach(() => {
    clearAgents();
    snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-registry-test-'));
    process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH = path.join(snapshotDir, 'registry-snapshot.json');
  });

  afterEach(() => {
    fs.rmSync(snapshotDir, { recursive: true, force: true });
    delete process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH;
  });

  it('registers a new agent with defaults', async () => {
    expect.hasAssertions();
    const result = await registerAgent(mockFirestore, {
      agent_id: 'new-agent-001',
      agent_name: 'New Agent',
      platform: 'Kimi Code CLI',
      machine_id: 'machine-001',
      machine_name: 'test-machine',
      machine_os: 'Darwin 25.5.0 arm64',
      workspace_path: '/tmp/new-workspace',
      agent_runtime: 'kimi-code-cli',
      agent_version: '1.0.0'
    });

    expect(result.agent_id).toBe('new-agent-001');
    expect(result.status).toBe('available');
    expect(result.capabilities).toContain('repository-wide source and documentation assimilation');
    expect(result.active_epic).toBe('none');
    expect(result.assigned_task).toBe('none');
  });

  it('preserves existing fields when re-registering', async () => {
    expect.hasAssertions();
    const existing = buildAgent({
      agent_id: 'existing-agent',
      status: 'busy',
      active_epic: 'https://linear.app/epic',
      assigned_task: 'https://linear.app/task'
    });
    seedAgent(existing);

    const result = await registerAgent(mockFirestore, {
      agent_id: 'existing-agent',
      agent_name: 'Updated Name',
      platform: 'Updated Platform',
      machine_id: 'machine-001',
      machine_name: 'test-machine',
      machine_os: 'Darwin 25.5.0 arm64',
      workspace_path: '/tmp/updated',
      agent_runtime: 'updated-runtime',
      agent_version: '2.0.0'
    });

    expect(result.status).toBe('busy');
    expect(result.active_epic).toBe('https://linear.app/epic');
    expect(result.assigned_task).toBe('https://linear.app/task');
    expect(result.agent_name).toBe('Updated Name');
  });

  it('rejects registration with missing required fields', async () => {
    expect.hasAssertions();
    await expect(
      registerAgent(mockFirestore, {
        agent_id: '',
        agent_name: 'Test',
        platform: 'Test',
        machine_id: 'machine',
        machine_name: 'machine',
        machine_os: 'os',
        workspace_path: '/tmp',
        agent_runtime: 'runtime',
        agent_version: '1.0'
      })
    ).rejects.toThrow('Field "agent_id" is required');
  });

  it('updates heartbeat for registered agent', async () => {
    expect.hasAssertions();
    seedAgent(buildAgent({ agent_id: 'heartbeat-agent' }));

    const result = await heartbeat(mockFirestore, {
      agent_id: 'heartbeat-agent',
      status: 'busy',
      main_ref_checked: 'new-main-ref'
    });

    expect(result.status).toBe('busy');
    expect(result.main_ref_checked).toBe('new-main-ref');
    expect(result.last_heartbeat_utc).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects heartbeat for unregistered agent', async () => {
    expect.hasAssertions();
    await expect(
      heartbeat(mockFirestore, { agent_id: 'missing-agent' })
    ).rejects.toThrow('not registered');
  });

  it('assigns task and marks agent busy', async () => {
    expect.hasAssertions();
    seedAgent(buildAgent({ agent_id: 'assign-agent' }));

    const result = await assignTask(mockFirestore, {
      agent_id: 'assign-agent',
      assigned_task: 'https://linear.app/task/123',
      active_epic: 'https://linear.app/epic/456'
    });

    expect(result.status).toBe('busy');
    expect(result.assigned_task).toBe('https://linear.app/task/123');
    expect(result.active_epic).toBe('https://linear.app/epic/456');
  });

  it('rejects assignment for an unregistered agent', async () => {
    expect.hasAssertions();

    await expect(assignTask(mockFirestore, {
      agent_id: 'missing-assign-agent',
      assigned_task: 'https://linear.app/task/123',
      active_epic: 'https://linear.app/epic/456'
    })).rejects.toThrow('not registered');
  });

  it('completes task and clears assignment', async () => {
    expect.hasAssertions();
    seedAgent(buildAgent({
      agent_id: 'complete-agent',
      status: 'busy',
      assigned_task: 'https://linear.app/task/123',
      active_epic: 'https://linear.app/epic/456'
    }));

    const result = await completeTask(mockFirestore, {
      agent_id: 'complete-agent',
      status: 'available'
    });

    expect(result.status).toBe('available');
    expect(result.assigned_task).toBe('none');
    expect(result.active_epic).toBe('none');
  });

  it('rejects completion for an unregistered agent', async () => {
    expect.hasAssertions();

    await expect(completeTask(mockFirestore, {
      agent_id: 'missing-complete-agent',
      status: 'available'
    })).rejects.toThrow('not registered');
  });

  it('syncs snapshot to local file', async () => {
    expect.hasAssertions();
    seedAgent(buildAgent({ agent_id: 'sync-agent-1' }));
    seedAgent(buildAgent({ agent_id: 'sync-agent-2' }));

    const snapshot = await syncSnapshot(mockFirestore);
    expect(snapshot.agents).toHaveLength(2);
    expect(snapshot.source).toBe('firestore');

    expect(fs.existsSync(snapshotPath())).toBe(true);
    const written = JSON.parse(fs.readFileSync(snapshotPath(), 'utf8'));
    expect(written.agents).toHaveLength(2);
  });

  it('creates the snapshot directory when it does not exist yet', async () => {
    expect.hasAssertions();
    process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH = path.join(
      snapshotDir,
      'nested',
      'registry-snapshot.json'
    );
    seedAgent(buildAgent({ agent_id: 'sync-agent-nested' }));

    await syncSnapshot(mockFirestore);

    expect(fs.existsSync(snapshotPath())).toBe(true);
  });

  it('passes check when snapshot matches Firestore', async () => {
    expect.hasAssertions();
    seedAgent(buildAgent({ agent_id: 'check-agent' }));
    await syncSnapshot(mockFirestore);

    await expect(checkSnapshot(mockFirestore)).resolves.toBeUndefined();
  });

  it('fails check when snapshot is missing', async () => {
    expect.hasAssertions();
    await expect(checkSnapshot(mockFirestore)).rejects.toThrow('not found');
  });

  it('fails check when snapshot is stale', async () => {
    expect.hasAssertions();
    seedAgent(buildAgent({ agent_id: 'stale-agent' }));
    await syncSnapshot(mockFirestore);

    // Modify Firestore after snapshot
    const agent = mockFirestore.agents.get('stale-agent') as AgentRecord;
    mockFirestore.agents.set('stale-agent', { ...agent, status: 'busy' });

    await expect(checkSnapshot(mockFirestore)).rejects.toThrow('out of sync');
  });
});
