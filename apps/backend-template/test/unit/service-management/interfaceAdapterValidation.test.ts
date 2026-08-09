/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Unit suite for the Communication Interface Designer adapter lifecycle
 * (JUM-545):
 *
 * - `packages/designer-core/src/model/interfaceFrameworkMatrix.js` — the
 *   per-interface-type framework subsets drawn from the canonical runtime
 *   matrix (JUM-461's canonical spellings; no `derby`/`sails` aliases), and
 * - `packages/designer-core/src/validation/interfaceAdapterValidation.js` —
 *   `normalizeInterfaceAdapterInput`, `collectInterfaceAdapterIssues`
 *   (vocabulary, entrypoint path, `XController.action` controller-mapping
 *   shape, uniqueness) and `upsertInterfaceAdapter` (the add/edit-in-place
 *   gate).
 *
 * All are exercised as pure functions — no DOM, no store.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  GRPC_FRAMEWORKS,
  HTTP_FRAMEWORKS,
  INTERFACE_TYPES,
  INTERFACE_TYPE_FRAMEWORKS,
  WEBSOCKET_FRAMEWORKS,
  getSupportedFrameworks,
  isFrameworkSupportedByType
} = require(
  '@jumentix/designer-core/model/interfaceFrameworkMatrix.js'
);
const {
  CONTROLLER_MAPPING_PATTERN,
  INTERFACE_ENTRYPOINT_PATTERN,
  collectInterfaceAdapterIssues,
  normalizeInterfaceAdapterInput,
  upsertInterfaceAdapter
} = require(
  '@jumentix/designer-core/validation/interfaceAdapterValidation.js'
);

const enumValuesFor = (scriptSource: string, key: string): string[] => {
  const match = scriptSource.match(new RegExp(`${key}: \\[([\\s\\S]*?)\\]`));
  if (!match) throw new Error(`enum for ${key} not found`);
  return Array.from(match[1].matchAll(/'([^']*)'/g), (m) => m[1]);
};

function createAdapter(overrides: Record<string, unknown> = {}): any {
  return {
    type: 'http-rest',
    framework: 'fastify',
    entrypoint: 'src/interface/HTTP/server.ts',
    controller: 'UsersController.create',
    ...overrides
  };
}

function messages(issues: Array<{ message: string }>) {
  return issues.map((issue) => issue.message);
}

describe('interface framework matrix (JUM-545)', () => {
  it('pins the interface types and the canonical framework subsets per type', () => {
    expect(INTERFACE_TYPES).toStrictEqual(['http-rest', 'grpc', 'websocket', 'sse']);
    expect(HTTP_FRAMEWORKS).toStrictEqual([
      'express', 'fastify', 'restify', 'cloudflare-workers', 'vercel-functions',
      'loopback', 'sails-js', 'feathers', 'derby-js', 'adonis-js', 'total-js'
    ]);
    expect(GRPC_FRAMEWORKS).toStrictEqual(['grpc']);
    expect(WEBSOCKET_FRAMEWORKS).toStrictEqual(['socket-io']);
    expect(INTERFACE_TYPE_FRAMEWORKS).toStrictEqual({
      'http-rest': HTTP_FRAMEWORKS,
      grpc: GRPC_FRAMEWORKS,
      websocket: WEBSOCKET_FRAMEWORKS,
      sse: HTTP_FRAMEWORKS
    });
  });

  it('offers only the JUM-461 canonical spellings — no alias duplicates', () => {
    expect(HTTP_FRAMEWORKS).not.toContain('derby');
    expect(HTTP_FRAMEWORKS).not.toContain('sails');
    expect(HTTP_FRAMEWORKS).not.toContain('hyper-express');
    (Object.values(INTERFACE_TYPE_FRAMEWORKS) as string[][]).forEach((frameworks) => {
      expect(new Set(frameworks).size).toBe(frameworks.length);
    });
  });

  it('keeps the HTTP subset in parity with the runtime env contract enum', () => {
    // Drift guard between the designer tab and the declared canonical mirror
    // (script.js RUNTIME_ENV_ENUM_OPTIONS, itself pinned against
    // RuntimeEnvironment.ts by runtimeEnvUi.contract.test.ts).
    const script = fs.readFileSync(path.join(repoRoot, 'apps', 'service-management', 'script.js'), 'utf-8');
    expect(enumValuesFor(script, 'JUMENTIX_HTTP_FRAMEWORK')).toStrictEqual(HTTP_FRAMEWORKS);
  });

  it('lookups fall back to empty/false for unknown values', () => {
    expect(getSupportedFrameworks('soap')).toStrictEqual([]);
    expect(isFrameworkSupportedByType('http-rest', 'socket-io')).toBe(false);
    expect(isFrameworkSupportedByType('websocket', 'socket-io')).toBe(true);
    expect(isFrameworkSupportedByType('websocket', 'fastify')).toBe(false);
    expect(isFrameworkSupportedByType('sse', 'express')).toBe(true);
  });
});

describe('adapter field patterns (JUM-545)', () => {
  it('accepts boilerplate entrypoint paths and rejects off-shape ones', () => {
    expect(INTERFACE_ENTRYPOINT_PATTERN.test('src/interface/HTTP/server.ts')).toBe(true);
    expect(INTERFACE_ENTRYPOINT_PATTERN.test('src/interface/WebSocket/adapters/socket-io/socket-io.ts')).toBe(true);
    expect(INTERFACE_ENTRYPOINT_PATTERN.test('src/interface/gRPC/server.js')).toBe(true);
    expect(INTERFACE_ENTRYPOINT_PATTERN.test('server.ts')).toBe(false);
    expect(INTERFACE_ENTRYPOINT_PATTERN.test('src/interface/server')).toBe(false);
    expect(INTERFACE_ENTRYPOINT_PATTERN.test('src/interface/server.py')).toBe(false);
    expect(INTERFACE_ENTRYPOINT_PATTERN.test('src/interface/../secrets.ts')).toBe(false);
  });

  it('accepts XController.action mappings and rejects off-shape ones', () => {
    expect(CONTROLLER_MAPPING_PATTERN.test('UsersController.create')).toBe(true);
    expect(CONTROLLER_MAPPING_PATTERN.test('UserController.getOneById')).toBe(true);
    expect(CONTROLLER_MAPPING_PATTERN.test('usersController.create')).toBe(false);
    expect(CONTROLLER_MAPPING_PATTERN.test('UsersController')).toBe(false);
    expect(CONTROLLER_MAPPING_PATTERN.test('UsersController.')).toBe(false);
    expect(CONTROLLER_MAPPING_PATTERN.test('UsersController.Create')).toBe(false);
    expect(CONTROLLER_MAPPING_PATTERN.test('Users.create')).toBe(false);
    expect(CONTROLLER_MAPPING_PATTERN.test('UsersController.create.extra')).toBe(false);
  });
});

describe('normalizeInterfaceAdapterInput (JUM-545)', () => {
  it('trims all four fields into the persisted record shape', () => {
    expect(normalizeInterfaceAdapterInput({
      type: ' http-rest ',
      framework: ' fastify ',
      entrypoint: ' src/interface/HTTP/server.ts ',
      controller: ' UsersController.create '
    })).toStrictEqual(createAdapter());
  });

  it('normalizes garbage input to empty strings', () => {
    expect(normalizeInterfaceAdapterInput(null)).toStrictEqual({
      type: '', framework: '', entrypoint: '', controller: ''
    });
    expect(normalizeInterfaceAdapterInput({ type: 42, framework: null })).toStrictEqual({
      type: '42', framework: '', entrypoint: '', controller: ''
    });
  });
});

describe('collectInterfaceAdapterIssues (JUM-545)', () => {
  it('accepts a valid adapter for every interface type', () => {
    expect(collectInterfaceAdapterIssues(createAdapter())).toStrictEqual([]);
    expect(collectInterfaceAdapterIssues(createAdapter({
      type: 'grpc', framework: 'grpc', entrypoint: 'src/interface/gRPC/server.ts', controller: 'UsersController.list'
    }))).toStrictEqual([]);
    expect(collectInterfaceAdapterIssues(createAdapter({
      type: 'websocket', framework: 'socket-io', entrypoint: 'src/interface/WebSocket/server.ts'
    }))).toStrictEqual([]);
    expect(collectInterfaceAdapterIssues(createAdapter({
      type: 'sse', framework: 'express', entrypoint: 'src/interface/HTTP/sse-server.ts'
    }))).toStrictEqual([]);
  });

  it('rejects an unknown interface type without running the framework rule', () => {
    // Same guard as the deploy-target validator: with an unknown vocabulary
    // value the combination rules stay silent — the vocabulary error names
    // the fix on its own.
    const found = messages(collectInterfaceAdapterIssues(createAdapter({ type: 'soap', framework: 'axis2' })));
    expect(found).toStrictEqual([
      'Interface type "soap" is not supported — choose one of: http-rest, grpc, websocket, sse.'
    ]);
  });

  it('rejects a framework outside the per-type subset, naming the valid options', () => {
    const found = messages(collectInterfaceAdapterIssues(createAdapter({ type: 'websocket', framework: 'fastify' })));
    expect(found).toStrictEqual([
      'Framework "fastify" is not supported for interface type "websocket" — choose one of: socket-io.'
    ]);
  });

  it('rejects the rejected JUM-461 alias spellings', () => {
    expect(messages(collectInterfaceAdapterIssues(createAdapter({ framework: 'derby' })))[0])
      .toContain('Framework "derby" is not supported for interface type "http-rest"');
    expect(messages(collectInterfaceAdapterIssues(createAdapter({ framework: 'sails' })))[0])
      .toContain('Framework "sails" is not supported for interface type "http-rest"');
  });

  it('requires framework, entrypoint and controller mapping', () => {
    const found = messages(collectInterfaceAdapterIssues(createAdapter({
      framework: '', entrypoint: '', controller: ''
    })));
    expect(found).toStrictEqual([
      'Framework/runtime is required.',
      'Entrypoint is required.',
      'Controller mapping is required.'
    ]);
  });

  it('rejects an off-shape entrypoint with the expected pattern', () => {
    const found = messages(collectInterfaceAdapterIssues(createAdapter({ entrypoint: 'server.ts' })));
    expect(found).toStrictEqual([
      'Entrypoint "server.ts" must be a TypeScript/JavaScript path under src/interface/ (e.g. src/interface/HTTP/server.ts).'
    ]);
  });

  it('rejects an off-shape controller mapping with the expected shape', () => {
    const found = messages(collectInterfaceAdapterIssues(createAdapter({ controller: 'userscontroller' })));
    expect(found).toStrictEqual([
      'Controller mapping "userscontroller" must have the shape XController.action (e.g. UsersController.create).'
    ]);
  });

  it('aggregates several issues and keeps the ModelIssue shape', () => {
    const issues = collectInterfaceAdapterIssues(createAdapter({
      framework: 'ws', entrypoint: 'nope', controller: 'nope'
    }));
    expect(issues).toHaveLength(3);
    issues.forEach((issue: any) => {
      expect(issue.severity).toBe('error');
      expect(issue.entityId).toBeNull();
    });
  });

  it('rejects a duplicate type + entrypoint pair with the reason', () => {
    const existing = [createAdapter()];
    const found = messages(collectInterfaceAdapterIssues(createAdapter({ controller: 'UsersController.list' }), existing));
    expect(found).toStrictEqual([
      'Duplicate adapter: interface type "http-rest" is already registered at entrypoint "src/interface/HTTP/server.ts".'
    ]);
  });

  it('rejects a duplicate controller mapping with the reason', () => {
    const existing = [createAdapter()];
    const found = messages(collectInterfaceAdapterIssues(createAdapter({
      entrypoint: 'src/interface/HTTP/other-server.ts'
    }), existing));
    expect(found).toStrictEqual([
      'Duplicate controller mapping "UsersController.create" — another adapter already maps it.'
    ]);
  });

  it('reports both duplicate rules when both collide', () => {
    const existing = [createAdapter()];
    expect(collectInterfaceAdapterIssues(createAdapter(), existing)).toHaveLength(2);
  });

  it('does not flag the same type + entrypoint on a different interface type', () => {
    const existing = [createAdapter()];
    expect(collectInterfaceAdapterIssues(createAdapter({
      type: 'sse', framework: 'fastify', controller: 'UsersController.list'
    }), existing)).toStrictEqual([]);
  });

  it('excludes the adapter being edited from the duplicate scan', () => {
    const existing = [createAdapter(), createAdapter({
      entrypoint: 'src/interface/HTTP/other-server.ts', controller: 'UsersController.list'
    })];
    // Re-saving entry 0 unchanged is not a duplicate of itself...
    expect(collectInterfaceAdapterIssues(existing[0], existing, 0)).toStrictEqual([]);
    // ...but re-saving it with entry 1's controller mapping is.
    expect(messages(collectInterfaceAdapterIssues(createAdapter({
      controller: 'UsersController.list'
    }), existing, 0))).toStrictEqual([
      'Duplicate controller mapping "UsersController.list" — another adapter already maps it.'
    ]);
  });

  it('treats a missing candidate and a non-array sibling list as field errors only', () => {
    expect(messages(collectInterfaceAdapterIssues(null))).toStrictEqual([
      'Interface type "" is not supported — choose one of: http-rest, grpc, websocket, sse.',
      'Framework/runtime is required.',
      'Entrypoint is required.',
      'Controller mapping is required.'
    ]);
    expect(collectInterfaceAdapterIssues(createAdapter(), 'junk')).toStrictEqual([]);
  });
});

describe('upsertInterfaceAdapter — the add/edit-in-place gate (JUM-545)', () => {
  it('appends a valid candidate when adding', () => {
    const existing = [createAdapter()];
    const result = upsertInterfaceAdapter(existing, createAdapter({
      entrypoint: 'src/interface/HTTP/other-server.ts', controller: 'UsersController.list'
    }));
    expect(result.issues).toStrictEqual([]);
    expect(result.adapters).toHaveLength(2);
    expect(result.adapters[1].controller).toBe('UsersController.list');
    // The gate never mutates the list it was given.
    expect(existing).toHaveLength(1);
  });

  it('replaces the entry at editingIndex when editing in place', () => {
    const existing = [
      createAdapter(),
      createAdapter({ entrypoint: 'src/interface/HTTP/other-server.ts', controller: 'UsersController.list' })
    ];
    const result = upsertInterfaceAdapter(existing, createAdapter({
      entrypoint: 'src/interface/HTTP/other-server.ts',
      framework: 'express',
      controller: 'UsersController.getOneById'
    }), 1);
    expect(result.issues).toStrictEqual([]);
    expect(result.adapters).toHaveLength(2);
    expect(result.adapters[0]).toStrictEqual(existing[0]);
    expect(result.adapters[1]).toStrictEqual(createAdapter({
      entrypoint: 'src/interface/HTTP/other-server.ts',
      framework: 'express',
      controller: 'UsersController.getOneById'
    }));
    expect(existing[1].controller).toBe('UsersController.list');
  });

  it('lets an edit keep its own type + entrypoint and controller mapping', () => {
    const existing = [createAdapter()];
    const result = upsertInterfaceAdapter(existing, createAdapter({ framework: 'restify' }), 0);
    expect(result.issues).toStrictEqual([]);
    expect(result.adapters[0].framework).toBe('restify');
  });

  it('refuses an invalid candidate and leaves the list untouched', () => {
    const existing = [createAdapter()];
    const result = upsertInterfaceAdapter(existing, createAdapter({
      entrypoint: 'src/interface/HTTP/other-server.ts'
    }));
    expect(result.adapters).toBeNull();
    expect(messages(result.issues)).toStrictEqual([
      'Duplicate controller mapping "UsersController.create" — another adapter already maps it.'
    ]);
  });

  it('refuses an editing index beyond the list end', () => {
    const result = upsertInterfaceAdapter([createAdapter()], createAdapter({
      entrypoint: 'src/interface/HTTP/other-server.ts', controller: 'UsersController.list'
    }), 5);
    expect(result.adapters).toBeNull();
    expect(messages(result.issues)).toStrictEqual(['Adapter index 5 does not exist.']);
  });

  it('adds to an empty list when the current list is missing', () => {
    const result = upsertInterfaceAdapter(null, createAdapter());
    expect(result.issues).toStrictEqual([]);
    expect(result.adapters).toStrictEqual([createAdapter()]);
  });
});

describe('interface designer tab wiring (JUM-545)', () => {
  const html = fs.readFileSync(path.join(repoRoot, 'apps', 'service-management', 'index.html'), 'utf-8');
  const script = fs.readFileSync(path.join(repoRoot, 'apps', 'service-management', 'script.js'), 'utf-8');
  const sw = fs.readFileSync(path.join(repoRoot, 'apps', 'service-management', 'sw.js'), 'utf-8');
  const inspectors = fs.readFileSync(path.join(repoRoot, 'apps', 'service-management', 'src', 'ui', 'inspectors.js'), 'utf-8');

  it('keeps the new modules in the offline shell precache (sw.js SHELL_ASSETS)', () => {
    // The browser integration suites (pwaShell, offlinePersistenceMatrix)
    // caught their absence: without a precache entry the offline shell cannot
    // resolve the module graph. Since JUM-493 the core modules are vendored
    // from packages/designer-core, so the precache names the vendored paths.
    expect(sw).toContain('\'./vendor/designer-core/model/interfaceFrameworkMatrix.js\'');
    expect(sw).toContain('\'./vendor/designer-core/validation/interfaceAdapterValidation.js\'');
  });

  it('replaces the free-text framework input with a matrix-driven select', () => {
    expect(html).toContain('id="interface-framework-select"');
    expect(html).not.toContain('id="interface-framework-input"');
  });

  it('wires the add handler and the edit-in-place save through the shared upsert gate', () => {
    expect(script).toContain('upsertInterfaceAdapter(state.interfaces, candidate)');
    expect(script).toContain('renderInterfaceFrameworkOptions');
    expect(inspectors).toContain('upsertInterfaceAdapter(state.interfaces, candidate, index)');
    expect(inspectors).toContain('editingAdapterIndex');
    // Validation messages go through the JUM-543 status surface, never alert().
    expect(script).not.toContain('window.alert(');
    expect(inspectors).not.toContain('window.alert(');
  });
});
