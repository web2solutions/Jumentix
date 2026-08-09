/* eslint-disable @typescript-eslint/no-explicit-any, camelcase */
import {
  busStatus,
  presenceFromAgent,
  publishProgress,
  upsertPresence,
  watchBus
} from '../src/bus-commands';
import type { AgentBusEvent, AgentRecord, RtdbLike } from '../src/types';

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
    status: 'busy',
    registered_at_utc: '2026-01-01T00:00:00.000Z',
    last_heartbeat_utc: '2026-08-09T00:00:00.000Z',
    last_branch_check_utc: '2026-08-09T00:00:00.000Z',
    main_ref_checked: 'abc123',
    dev_ref_checked: 'def456',
    active_epic: 'https://linear.app/jumentix/project/cana',
    assigned_task: 'JUM-615',
    capabilities: ['test'],
    ...overrides
  };
}

function createMockRtdb() {
  const store = new Map<string, unknown>();
  let pushCounter = 0;
  const listeners = new Map<string, Set<(snap: any) => void>>();

  function normalize(path: string): string {
    return path.replace(/^\/+|\/+$/g, '');
  }

  function childPaths(prefix: string): string[] {
    const root = normalize(prefix);
    return Array.from(store.keys()).filter((key) => (
      key === root || key.startsWith(`${root}/`)
    ));
  }

  function makeRef(path: string): any {
    const full = normalize(path);
    return {
      child: (segment: string) => makeRef(`${full}/${segment}`),
      set: async (value: unknown) => {
        store.set(full, value);
        const parent = full.includes('/') ? full.slice(0, full.lastIndexOf('/')) : '';
        const key = full.includes('/') ? full.slice(full.lastIndexOf('/') + 1) : full;
        const handlers = listeners.get(parent);
        if (handlers) {
          const snap = { key, val: () => value };
          for (const handler of handlers) handler(snap);
        }
      },
      push: (value?: unknown) => {
        pushCounter += 1;
        const key = `push-${pushCounter}`;
        const childPath = `${full}/${key}`;
        return {
          key,
          set: async (payload: unknown) => {
            store.set(childPath, payload ?? value);
            const handlers = listeners.get(full);
            if (handlers) {
              const snap = { key, val: () => payload ?? value };
              for (const handler of handlers) handler(snap);
            }
          }
        };
      },
      update: async (value: Record<string, unknown>) => {
        store.set(full, { ...(store.get(full) as object || {}), ...value });
      },
      once: async () => {
        const children = childPaths(full)
          .filter((key) => key !== full && key.split('/').length === full.split('/').length + 1)
          .map((key) => {
            const childKey = key.slice(full.length + 1);
            return {
              key: childKey,
              val: () => store.get(key),
              forEach: () => undefined
            };
          });

        // Presence root and event collections return children via forEach.
        return {
          key: full.split('/').pop() || null,
          val: () => store.get(full) ?? null,
          forEach: (callback: (child: any) => boolean | void) => {
            for (const child of children) {
              if (callback(child) === true) break;
            }
          }
        };
      },
      on: (eventType: string, callback: (snap: any) => void) => {
        if (eventType !== 'child_added') return callback;
        if (!listeners.has(full)) listeners.set(full, new Set());
        listeners.get(full)!.add(callback);
        // Replay existing children.
        for (const key of childPaths(full)) {
          const isDirectChild = key !== full
            && key.split('/').length === full.split('/').length + 1;
          if (isDirectChild) {
            const childKey = key.slice(full.length + 1);
            callback({ key: childKey, val: () => store.get(key) });
          }
        }
        return callback;
      },
      off: (eventType?: string, callback?: (snap: any) => void) => {
        if (eventType && eventType !== 'child_added') return;
        const set = listeners.get(full);
        if (!set) return;
        if (callback) set.delete(callback);
        else set.clear();
      },
      orderByChild: () => makeRef(full),
      limitToLast: () => makeRef(full)
    };
  }

  const rtdb: RtdbLike = {
    ref: (path = '') => makeRef(path)
  };

  return { rtdb, store };
}

describe('agent-bus commands', () => {
  it('builds presence from an agent record', () => {
    expect.hasAssertions();
    const presence = presenceFromAgent(buildAgent(), { branch: 'kimi/feature/x' });
    expect(presence).toMatchObject({
      agentId: 'test-agent-001',
      status: 'busy',
      epicId: 'https://linear.app/jumentix/project/cana',
      taskId: 'JUM-615',
      branch: 'kimi/feature/x',
      machineId: 'machine-001'
    });
  });

  it('upserts presence and publishes progress events', async () => {
    expect.hasAssertions();
    const { rtdb, store } = createMockRtdb();
    const agent = buildAgent();
    await upsertPresence(rtdb, presenceFromAgent(agent));

    const presenceKey = Array.from(store.keys()).find((key) => key.startsWith('agent-bus/presence/'));
    expect(presenceKey).toBeTruthy();
    expect(store.get(presenceKey!)).toMatchObject({ agentId: 'test-agent-001', taskId: 'JUM-615' });

    const published = await publishProgress(rtdb, {
      agentId: agent.agent_id,
      epicId: agent.active_epic,
      taskId: agent.assigned_task,
      kind: 'progress',
      summary: 'fallback wired',
      refs: ['PR #138'],
      ts: '2026-08-09T12:00:00.000Z'
    });

    expect(published).toStrictEqual(expect.objectContaining({
      kind: 'progress',
      summary: 'fallback wired',
      pushId: expect.stringMatching(/^push-/),
      ttlHint: expect.any(String)
    }));
  });

  it('rejects invalid publish kinds and empty fields', async () => {
    expect.hasAssertions();
    const { rtdb } = createMockRtdb();
    await expect(publishProgress(rtdb, {
      agentId: 'a',
      epicId: 'e',
      taskId: 't',
      kind: 'nope' as any,
      summary: 'x'
    })).rejects.toThrow('kind');

    await expect(publishProgress(rtdb, {
      agentId: '',
      epicId: 'e',
      taskId: 't',
      kind: 'progress',
      summary: 'x'
    })).rejects.toThrow('agentId');
  });

  it('watches events and filters by since', async () => {
    expect.hasAssertions();
    const { rtdb } = createMockRtdb();
    const seen: AgentBusEvent[] = [];

    const unsub = watchBus(rtdb, {
      epicId: 'epic-a',
      since: '2026-08-09T12:00:00.000Z',
      onEvent: (event) => { seen.push(event); }
    });

    await publishProgress(rtdb, {
      agentId: 'a1',
      epicId: 'epic-a',
      taskId: 't1',
      kind: 'started',
      summary: 'old',
      ts: '2026-08-09T11:00:00.000Z'
    });
    await publishProgress(rtdb, {
      agentId: 'a1',
      epicId: 'epic-a',
      taskId: 't1',
      kind: 'progress',
      summary: 'new',
      ts: '2026-08-09T13:00:00.000Z'
    });

    expect(seen.map((event) => event.summary)).toStrictEqual(['new']);
    unsub();
  });

  it('returns status with presence and recent events for an epic', async () => {
    expect.hasAssertions();
    const { rtdb } = createMockRtdb();
    await upsertPresence(rtdb, presenceFromAgent(buildAgent({
      active_epic: 'epic-a',
      assigned_task: 'JUM-1'
    })));
    await upsertPresence(rtdb, presenceFromAgent(buildAgent({
      agent_id: 'other',
      active_epic: 'epic-b',
      assigned_task: 'JUM-2'
    })));
    await publishProgress(rtdb, {
      agentId: 'test-agent-001',
      epicId: 'epic-a',
      taskId: 'JUM-1',
      kind: 'blocked',
      summary: 'waiting on review',
      ts: '2026-08-09T14:00:00.000Z'
    });

    const status = await busStatus(rtdb, 'epic-a');
    expect(status.presence).toHaveLength(1);
    expect(status.presence[0].agentId).toBe('test-agent-001');
    expect(status.recentEvents).toHaveLength(1);
    expect(status.recentEvents[0].kind).toBe('blocked');
  });

  it('fails closed when RTDB set throws', async () => {
    expect.hasAssertions();
    const rtdb: RtdbLike = {
      ref: () => ({
        set: async () => { throw new Error('permission denied'); },
        child: () => { throw new Error('unused'); },
        push: () => ({ key: null, set: async () => undefined }),
        update: async () => undefined,
        once: async () => ({ key: null, val: () => null, forEach: () => undefined }),
        on: () => () => undefined,
        off: () => undefined,
        orderByChild: function orderByChild() { return this; },
        limitToLast: function limitToLast() { return this; }
      }) as any
    };

    await expect(upsertPresence(rtdb, presenceFromAgent(buildAgent())))
      .rejects.toThrow('RTDB presence upsert failed');
  });
});
