/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  checkSnapshot,
  completeTask,
  deleteAgent,
  generateSnapshot,
  getAgent,
  getAllAgents,
  getStoredAgents,
  heartbeat,
  repairRegistry,
  syncSnapshot,
  upsertAgent
} from '../src';
import type { AgentRecord } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * The repair is a one-way operation against a shared, live collection: it
 * rewrites documents other agents own and deletes the ones it merges. So the
 * cases that matter are the ones where getting it wrong loses data — a corrupt
 * document shadowing a clean one, an id that cannot be recovered, a repair that
 * would write back something still invalid.
 *
 * The double keys by document id rather than by `agent_id`, because those two
 * disagreeing is the entire defect (JUM-613).
 */

const store = new Map<string, AgentRecord>();

const firestore = {
  collection: () => ({
    doc: (id: string) => ({
      get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
      set: async (data: AgentRecord) => { store.set(id, data); },
      delete: async () => { store.delete(id); }
    }),
    get: async () => ({
      docs: [...store.entries()].map(([id, agent]) => ({ id, data: () => agent }))
    })
  })
} as any;

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

/** Stores a record exactly as the JUM-611 migration wrote one. */
function seedMigrated(agentId: string, overrides: Partial<Record<string, unknown>> = {}) {
  const clean = buildAgent({ agent_id: agentId });
  const wrapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(clean)) {
    wrapped[key] = typeof value === 'string' ? `\`${value}\`` : value;
  }
  wrapped.capabilities = (clean.capabilities || []).map((capability) => `\`${capability}\``);
  Object.assign(wrapped, overrides);
  // Through `unknown`: the whole point of this fixture is that it does not
  // satisfy AgentRecord.
  store.set(`\`${agentId}\``, wrapped as unknown as AgentRecord);
}

/**
 * Every case starts from an empty collection. The reset lives inside the outer
 * describe so it belongs to something rather than floating at the top level.
 */
describe('the agent registry repair', () => {
  beforeEach(() => {
    store.clear();
  });

  describe('repairRegistry, reporting', () => {
    it('changes nothing unless it is told to apply', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001');

      const result = await repairRegistry(firestore);

      expect(result.applied).toBe(false);
      expect(result.actions).toHaveLength(1);
      // The corrupt document is still exactly where it was.
      expect([...store.keys()]).toStrictEqual(['`codex-primary-001`']);
    });

    it('leaves records that are already sound alone', async () => {
      expect.hasAssertions();

      store.set('codex-primary-001', buildAgent({ agent_id: 'codex-primary-001' }));

      const result = await repairRegistry(firestore, { apply: true });

      expect(result.actions).toStrictEqual([]);
      expect(store.size).toBe(1);
    });

    it('names the fields it cleaned', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001');

      const [action] = (await repairRegistry(firestore)).actions;

      expect(action.kind).toBe('merge');
      expect(action.canonicalId).toBe('codex-primary-001');
      expect(action.fieldsCleaned).toContain('workspace_path');
      expect(action.fieldsCleaned).toContain('status');
    });
  });

  describe('repairRegistry, applying', () => {
    it('refiles a corrupt document under its canonical id and removes the old one', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001');

      await repairRegistry(firestore, { apply: true });

      expect([...store.keys()]).toStrictEqual(['codex-primary-001']);
      expect(store.get('codex-primary-001')).toStrictEqual(
        buildAgent({ agent_id: 'codex-primary-001' })
      );
    });

    it('restores status to a member of the union', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001', { status: '`busy`' });

      await repairRegistry(firestore, { apply: true });

      expect(store.get('codex-primary-001')?.status).toBe('busy');
    });

    it('cleans the capabilities list', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001');

      await repairRegistry(firestore, { apply: true });

      expect(store.get('codex-primary-001')?.capabilities).toStrictEqual(['test']);
    });

    /**
     * `workspace_path: "unknown"` is a Requirement 114 gap belonging to the agent
     * that owns the record. Filling it in would hide the gap rather than close
     * it, so the repair cleans values and never invents them.
     */
    it('preserves an unknown workspace path instead of inventing one', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001', { workspace_path: '`unknown`' });

      await repairRegistry(firestore, { apply: true });

      expect(store.get('codex-primary-001')?.workspace_path).toBe('unknown');
    });

    /**
     * One live record's `active_epic` was a whole sentence with inline code
     * spans in the middle. Stripping only the wrapping pair left formatting
     * behind, and the repair refused to write the record back — correctly.
     */
    it('removes inline formatting from the middle of a value, keeping the words', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001', {
        active_epic: '`none` (epic closed: JUM-581, promoted as `cf6098b`)'
      });

      await repairRegistry(firestore, { apply: true });

      expect(store.get('codex-primary-001')?.active_epic)
        .toBe('none (epic closed: JUM-581, promoted as cf6098b)');
    });

    it('replaces capabilities that are not a list with an empty one', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001', { capabilities: 'one, two' });

      await repairRegistry(firestore, { apply: true });

      expect(store.get('codex-primary-001')?.capabilities).toStrictEqual([]);
    });

    it('repairs a corrupt record in place when its id was already right', async () => {
      expect.hasAssertions();

      store.set('codex-primary-001', buildAgent({
        agent_id: 'codex-primary-001',
        workspace_path: '`/tmp/x`'
      }));

      const [action] = (await repairRegistry(firestore, { apply: true })).actions;

      expect(action.kind).toBe('rewrite');
      expect(action.deletes).toBeUndefined();
      expect(store.get('codex-primary-001')?.workspace_path).toBe('/tmp/x');
    });
  });

  describe('repairRegistry, when a corrupt document shadows a clean one', () => {
    /**
     * The live collection held this twice over. The clean document was written
     * later, by the CLI, from a running agent; the corrupt one is a snapshot of a
     * markdown file from July. Letting the corrupt one win would roll a live
     * agent back to stale data.
     */
    it('keeps the clean record and discards the stale migrated values', async () => {
      expect.hasAssertions();

      seedMigrated('kimi-code-primary-001', { workspace_path: '`/old/path`' });
      store.set('kimi-code-primary-001', buildAgent({
        agent_id: 'kimi-code-primary-001',
        workspace_path: '/current/path',
        status: 'busy'
      }));

      await repairRegistry(firestore, { apply: true });

      expect(store.size).toBe(1);
      expect(store.get('kimi-code-primary-001')?.workspace_path).toBe('/current/path');
      expect(store.get('kimi-code-primary-001')?.status).toBe('busy');
    });

    it('collapses the pair into a single document', async () => {
      expect.hasAssertions();

      seedMigrated('kimi-code-primary-001');
      store.set('kimi-code-primary-001', buildAgent({ agent_id: 'kimi-code-primary-001' }));

      await repairRegistry(firestore, { apply: true });

      expect([...store.keys()]).toStrictEqual(['kimi-code-primary-001']);
    });
  });

  describe('repairRegistry, when it cannot repair safely', () => {
    it('refuses a document whose id cannot be recovered', async () => {
      expect.hasAssertions();

      store.set('``', buildAgent({ agent_id: '``' }));

      await expect(repairRegistry(firestore, { apply: true }))
        .rejects.toThrow(/no recoverable agent id/);
    });

    /**
     * A status that survives cleaning but still is not in the union is a value
     * nobody can derive. Guessing `available` would mark a busy agent free.
     */
    it('refuses a status it would have to guess at', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001', { status: '`working`' });

      await expect(repairRegistry(firestore, { apply: true }))
        .rejects.toThrow(/unrecognised status "working"/);
    });

    it('refuses to write back a record that is still invalid after cleaning', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001', { platform: '``' });

      await expect(repairRegistry(firestore, { apply: true }))
        .rejects.toThrow(/does not produce a valid record/);
    });

    it('leaves the collection untouched when it refuses', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001', { status: '`working`' });

      await expect(repairRegistry(firestore, { apply: true }))
        .rejects.toThrow(/unrecognised status/);
      expect([...store.keys()]).toStrictEqual(['`codex-primary-001`']);
    });
  });

  describe('checkSnapshot over a corrupt collection', () => {
    const snapshotFile = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'registry-repair-')),
      'snapshot.json'
    );

    beforeEach(() => {
      process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH = snapshotFile;
    });

    afterEach(() => {
      delete process.env.JUMENTIX_AGENT_REGISTRY_SNAPSHOT_PATH;
    });

    /**
     * The false green. This check compared both sides keyed by `agent_id`, so a
     * corrupt document and its clean twin were two unrelated keys that each
     * matched — and the gate reported success over ten broken records.
     */
    it('fails on corrupt records instead of reporting a match', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001');
      await syncSnapshot(firestore);

      await expect(checkSnapshot(firestore)).rejects.toThrow(/integrity problem/);
    });

    it('points at the repair rather than at another sync', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001');
      await syncSnapshot(firestore);

      await expect(checkSnapshot(firestore)).rejects.toThrow(/agent-registry:repair/);
    });

    it('fails when one agent holds more than one document', async () => {
      expect.hasAssertions();

      // Two documents, both individually well-formed, that claim the same agent.
      store.set('kimi-code-primary-001', buildAgent({ agent_id: 'kimi-code-primary-001' }));
      store.set('kimi-code-primary-001-copy', buildAgent({ agent_id: 'kimi-code-primary-001' }));
      await syncSnapshot(firestore);

      await expect(checkSnapshot(firestore))
        .rejects.toThrow(/more than one document per agent: kimi-code-primary-001/);
    });

    it('passes once the collection is repaired', async () => {
      expect.hasAssertions();

      seedMigrated('codex-primary-001');
      seedMigrated('kimi-code-primary-001');
      store.set('kimi-code-primary-001', buildAgent({ agent_id: 'kimi-code-primary-001' }));

      await repairRegistry(firestore, { apply: true });
      await syncSnapshot(firestore);

      await expect(checkSnapshot(firestore)).resolves.toBeUndefined();
      expect(store.size).toBe(2);
    });

    it('reports an agent Firestore has and the snapshot does not', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a' }));
      await syncSnapshot(firestore);
      store.set('b', buildAgent({ agent_id: 'b' }));

      await expect(checkSnapshot(firestore)).rejects.toThrow(/Missing in local: b/);
    });

    it('reports an agent the snapshot has and Firestore does not', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a' }));
      store.set('b', buildAgent({ agent_id: 'b' }));
      await syncSnapshot(firestore);
      store.delete('b');

      await expect(checkSnapshot(firestore)).rejects.toThrow(/Missing in Firestore: b/);
    });
  });

  describe('the package entry point', () => {
    /**
     * Exercised through the barrel rather than the modules: that is the surface
     * the CLI consumes, and a re-export dropped from `index.ts` would otherwise
     * pass every test in this package.
     */
    it('reads stored documents with their ids and their integrity assessed', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a' }));
      seedMigrated('b');

      const stored = await getStoredAgents(firestore);

      expect(stored.map((entry) => entry.documentId)).toStrictEqual(['a', '`b`']);
      expect(stored[0].problems).toStrictEqual([]);
      expect(stored[1].problems.length).toBeGreaterThan(0);
    });

    it('lists agents and generates a snapshot from Firestore', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a' }));

      await expect(getAllAgents(firestore))
        .resolves.toStrictEqual([buildAgent({ agent_id: 'a' })]);

      const snapshot = await generateSnapshot(firestore);

      expect(snapshot.source).toBe('firestore');
      expect(snapshot.agents).toHaveLength(1);
    });

    it('reads one agent by id, and reports a missing one as null', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a' }));

      await expect(getAgent(firestore, 'a'))
        .resolves.toStrictEqual(buildAgent({ agent_id: 'a' }));
      await expect(getAgent(firestore, 'absent')).resolves.toBeNull();
    });

    /**
     * The write boundary reached through the barrel. This is the call the
     * migration made ten times with a corrupt record and no objection.
     */
    it('refuses to write a record that fails the integrity rules', async () => {
      expect.hasAssertions();

      await upsertAgent(firestore, buildAgent({ agent_id: 'a' }));

      expect(store.has('a')).toBe(true);

      await expect(upsertAgent(firestore, buildAgent({ agent_id: '`b`' })))
        .rejects.toThrow(/Refusing to write an invalid agent registry record/);
      expect(store.has('`b`')).toBe(false);
    });

    it('deletes a document by id', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a' }));

      await deleteAgent(firestore, 'a');

      expect(store.size).toBe(0);
    });

    it('keeps the existing status and refs when a heartbeat names none', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a', status: 'busy' }));

      const agent = await heartbeat(firestore, { agent_id: 'a' });

      expect(agent.status).toBe('busy');
      expect(agent.main_ref_checked).toBe('abc123');
    });

    it('frees an agent by default when a task completes', async () => {
      expect.hasAssertions();

      store.set('a', buildAgent({ agent_id: 'a', status: 'busy', assigned_task: 'JUM-1' }));

      const agent = await completeTask(firestore, { agent_id: 'a' });

      expect(agent.status).toBe('available');
      expect(agent.assigned_task).toBe('none');
    });
  });
});
