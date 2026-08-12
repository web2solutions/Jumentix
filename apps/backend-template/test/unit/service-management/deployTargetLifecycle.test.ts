/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */

/**
 * Unit suite for the Deploy Management lifecycle (JUM-546):
 *
 * - `packages/designer-core/src/validation/deployTargetLifecycleValidation.js`
 *   (`collectDeployTargetFieldIssues` — name required/unique, runtime/version
 *   pattern, region per target type; `duplicateDeployTargetName` — the
 *   ` (copy)` renaming rule; `deployTargetFieldHint` — target-type-aware
 *   field guidance), and
 * - the self-hosted half of the shared matrix reader
 *   (`SELF_HOSTED_DEPLOY_TARGETS` / `isSelfHostedDeployTarget` in
 *   `src/model/deployCapabilityMatrix.js`) the region rule derives from, and
 * - the duplicate-as-deep-copy semantics the UI gate applies through
 *   `normalizeDeploymentInput`.
 *
 * All exercised as pure functions — no DOM, no store.
 */

const {
  RUNTIME_VERSION_PATTERN,
  collectDeployTargetFieldIssues,
  deployTargetFieldHint,
  duplicateDeployTargetName
} = require(
  '@jumentix/designer-core/validation/deployTargetLifecycleValidation.js'
);
const {
  DEPLOY_TARGETS,
  SELF_HOSTED_DEPLOY_TARGETS,
  isSelfHostedDeployTarget
} = require(
  '@jumentix/designer-core/model/deployCapabilityMatrix.js'
);
const { normalizeDeploymentInput } = require(
  '@jumentix/designer-core/state/designerState.js'
);

function createTarget(overrides: Record<string, unknown> = {}): any {
  return {
    name: 'prod-us-east-1',
    region: 'us-east-1',
    runtime: 'nodejs22.x',
    serviceType: 'restapi',
    deployTarget: 'dedicated-server',
    runtimeProtocol: 'http',
    databaseDriver: 'Mongo',
    keyValueDriver: 'redis',
    pm2Profile: 'dev',
    ...overrides
  };
}

function messages(issues: Array<{ message: string }>) {
  return issues.map((issue) => issue.message);
}

describe('self-hosted deploy targets in the shared matrix reader (JUM-546)', () => {
  it('pins the Dedicated Server (SSH) row as the only self-hosted target', () => {
    expect.hasAssertions();
    expect(SELF_HOSTED_DEPLOY_TARGETS).toStrictEqual(['dedicated-server']);
    SELF_HOSTED_DEPLOY_TARGETS.forEach(
      (target: string) => expect(DEPLOY_TARGETS).toContain(target)
    );
    expect(isSelfHostedDeployTarget('dedicated-server')).toBe(true);
    expect(isSelfHostedDeployTarget('vm')).toBe(false);
    expect(isSelfHostedDeployTarget('lambda')).toBe(false);
    expect(isSelfHostedDeployTarget('azure-functions')).toBe(false);
  });
});

describe('rUNTIME_VERSION_PATTERN (JUM-546)', () => {
  it('accepts name-plus-version spellings, including the provider wildcard', () => {
    expect.hasAssertions();
    ['nodejs22.x', 'nodejs22', 'node20', 'python3.12', 'go1.22', 'bun1.3.14', 'dotnet8.0']
      .forEach((runtime) => expect(RUNTIME_VERSION_PATTERN.test(runtime)).toBe(true));
  });

  it('rejects free-text, bare versions, empty and malformed values', () => {
    expect.hasAssertions();
    ['latest', 'lts', '22', '', 'node js22', 'nodejs22.', '-node20', 'nodejs 22.x']
      .forEach((runtime) => expect(RUNTIME_VERSION_PATTERN.test(runtime)).toBe(false));
  });
});

describe('collectDeployTargetFieldIssues (JUM-546)', () => {
  it('accepts a valid cloud target', () => {
    expect.hasAssertions();
    expect(collectDeployTargetFieldIssues(createTarget({ deployTarget: 'vm' }), [])).toStrictEqual([]);
  });

  it('accepts a valid self-hosted target with no region', () => {
    expect.hasAssertions();
    expect(collectDeployTargetFieldIssues(createTarget({ region: '' }), [])).toStrictEqual([]);
  });

  it('requires a name', () => {
    expect.hasAssertions();
    expect(messages(collectDeployTargetFieldIssues(createTarget({ name: ' ' }), [])))
      .toContain('Deploy target name is required.');
  });

  it('rejects a duplicate name, case-insensitively', () => {
    expect.hasAssertions();
    const existing = [createTarget({ name: 'Prod-US-East-1' })];
    expect(messages(collectDeployTargetFieldIssues(createTarget(), existing)))
      .toStrictEqual(['A deploy target named "prod-us-east-1" already exists — target names must be unique.']);
  });

  it('lets an edit keep its own name when the entry is excluded', () => {
    expect.hasAssertions();
    const existing = [createTarget(), createTarget({ name: 'staging' })];
    expect(collectDeployTargetFieldIssues(createTarget(), existing, { excludeIndex: 0 }))
      .toStrictEqual([]);
    // ...but renaming onto a DIFFERENT existing name is still rejected.
    expect(messages(collectDeployTargetFieldIssues(createTarget({ name: 'staging' }), existing, { excludeIndex: 0 })))
      .toStrictEqual(['A deploy target named "staging" already exists — target names must be unique.']);
  });

  it('requires a runtime/version and enforces the name-plus-version pattern', () => {
    expect.hasAssertions();
    expect(messages(collectDeployTargetFieldIssues(createTarget({ runtime: '' }), [])))
      .toContain('Runtime/version is required — use a name plus version, like "nodejs22.x".');
    expect(messages(collectDeployTargetFieldIssues(createTarget({ runtime: 'latest' }), [])))
      .toStrictEqual(['Runtime/version "latest" is not a valid runtime/version — use a name plus version, like "nodejs22.x".']);
  });

  it('requires a region on every cloud deploy target, naming the target', () => {
    expect.hasAssertions();
    ['vm', 'ec2', 'lambda', 'vercel-functions', 'cloudflare-workers'].forEach((deployTarget) => {
      expect(messages(collectDeployTargetFieldIssues(createTarget({ deployTarget, region: '' }), [])))
        .toStrictEqual([
          `Region is required for cloud deploy target "${deployTarget}" — enter the provider region, like "us-east-1".`
        ]);
    });
  });

  it('still requires a region when the deploy target is unknown or empty', () => {
    expect.hasAssertions();
    expect(messages(collectDeployTargetFieldIssues(createTarget({ deployTarget: 'azure-functions', region: '' }), [])))
      .toStrictEqual(['Region is required for cloud deploy target "azure-functions" — enter the provider region, like "us-east-1".']);
    expect(messages(collectDeployTargetFieldIssues(createTarget({ deployTarget: '', region: '' }), [])))
      .toContain('Region is required for cloud deploy targets — enter the provider region, like "us-east-1".');
  });

  it('accumulates every violated rule with severity error', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetFieldIssues(
      createTarget({
        name: '', region: '', runtime: 'nope', deployTarget: 'lambda'
      }),
      null
    );
    expect(issues).toHaveLength(3);
    issues.forEach((issue: { severity: string; entityId: string | null }) => {
      expect(issue.severity).toBe('error');
      expect(issue.entityId).toBeNull();
    });
  });
});

describe('duplicateDeployTargetName (JUM-546 renaming rule)', () => {
  it('suffixes the first duplicate with " (copy)"', () => {
    expect.hasAssertions();
    expect(duplicateDeployTargetName('prod-us-east-1', ['prod-us-east-1'])).toBe('prod-us-east-1 (copy)');
  });

  it('counts up until the name is free', () => {
    expect.hasAssertions();
    expect(duplicateDeployTargetName('prod', ['prod', 'prod (copy)'])).toBe('prod (copy 2)');
    expect(duplicateDeployTargetName('prod', ['prod', 'prod (copy)', 'prod (copy 2)'])).toBe('prod (copy 3)');
  });

  it('compares case-insensitively and trims the base', () => {
    expect.hasAssertions();
    expect(duplicateDeployTargetName(' Prod ', ['prod (copy)'])).toBe('Prod (copy 2)');
  });

  it('duplicating a duplicate nests the rule on the new base', () => {
    expect.hasAssertions();
    const existing = ['prod', 'prod (copy)'];
    expect(duplicateDeployTargetName('prod (copy)', existing)).toBe('prod (copy) (copy)');
  });

  it('falls back to a base for an empty name and tolerates non-array input', () => {
    expect.hasAssertions();
    expect(duplicateDeployTargetName('', [])).toBe('target (copy)');
    expect(duplicateDeployTargetName('prod', null as any)).toBe('prod (copy)');
  });
});

describe('deployTargetFieldHint (JUM-546 target-type-aware hints)', () => {
  it('points PM2-managed targets at host information and the PM2 profile', () => {
    expect.hasAssertions();
    ['dedicated-server', 'vm', 'ec2'].forEach((deployTarget) => {
      const hint = deployTargetFieldHint(deployTarget);
      expect(hint).toContain(deployTarget);
      expect(hint).toContain('host');
      expect(hint).toContain('PM2 profile');
    });
  });

  it('points function providers at the runtime/version and no PM2 profile', () => {
    expect.hasAssertions();
    ['lambda', 'vercel-functions', 'cloudflare-workers'].forEach((deployTarget) => {
      const hint = deployTargetFieldHint(deployTarget);
      expect(hint).toContain(deployTarget);
      expect(hint).toContain('runtime/version');
      expect(hint).toContain('no PM2 profile applies');
    });
  });

  it('guides the empty and unknown selections honestly', () => {
    expect.hasAssertions();
    expect(deployTargetFieldHint('')).toContain('Choose a deploy target');
    expect(deployTargetFieldHint('azure-functions')).toContain('is not a Requirement 059 matrix row');
  });
});

describe('duplicate semantics — an independent deep copy (JUM-546 acceptance)', () => {
  it('the duplicated target re-normalises to the pinned shape and edits do not leak into the source', () => {
    expect.hasAssertions();
    const source = createTarget({ deployTarget: 'vm', pm2Profile: 'staging' });
    const copy = normalizeDeploymentInput(JSON.parse(JSON.stringify(source)));
    copy.name = duplicateDeployTargetName(source.name, [source.name]);

    expect(copy).toStrictEqual({ ...source, name: 'prod-us-east-1 (copy)' });
    expect(copy).not.toBe(source);

    copy.region = 'eu-west-1';
    copy.pm2Profile = 'production';
    expect(source.region).toBe('us-east-1');
    expect(source.pm2Profile).toBe('staging');
  });
});

describe('defensive fallbacks (JUM-493)', () => {
  it('treats a null candidate as all-fields-missing, against no existing deployments', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetFieldIssues(null);
    const nullMessages = issues.map((issue: { message: string }) => issue.message);
    expect(nullMessages).toContain('Deploy target name is required.');
  });

  it('ignores null entries when checking duplicate names', () => {
    expect.hasAssertions();
    const issues = collectDeployTargetFieldIssues({
      name: 'db', region: 'us-east-1', runtime: 'node22', deployTarget: 'vm'
    }, [null]);
    const dupMessages = issues.map((issue: { message: string }) => issue.message);
    expect(dupMessages.some((message: string) => message.includes('already exists'))).toBe(false);
  });

  it('derives copy names with the default name list and skips nullish taken names', () => {
    expect.hasAssertions();
    expect(duplicateDeployTargetName('db')).toBe('db (copy)');
    expect(duplicateDeployTargetName('db', [null, 'db (copy)'])).toBe('db (copy 2)');
  });
});

// Keeps this file a module: with no import/export left, TypeScript would
// treat it as a script and its top-level requires would share one global
// scope with every other script-mode suite in ts-jest's program (TS2451).
// eslint-disable-next-line jest/no-export
export {};
