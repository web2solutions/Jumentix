/**
 * Branch and security coverage for the npm-org check's CLI resolution
 * (JUM-859). The bare `execFileSync('npm', ...)` form let PATH decide which
 * binary answered an authentication question (Sonar javascript:S4036,
 * code-scanning alert #114); these tests pin the absolute-path resolution
 * and its fail-closed behaviour.
 */

const {
  NPM_INSTALL_CANDIDATES,
  NPM_SCOPE,
  checkNpmOrgAccess,
  resolveNpmCommand
} = require('../check-npm-org-integration');

describe('resolveNpmCommand (JUM-859)', () => {
  it('prefers npm self-reported absolute paths when run as an npm script', () => {
    expect.hasAssertions();
    const resolved = resolveNpmCommand({
      env: {
        npm_execpath: '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
        npm_node_execpath: '/usr/local/bin/node'
      },
      execPath: '/should/not/be/used',
      exists: () => false
    });
    expect(resolved).toStrictEqual({
      command: '/usr/local/bin/node',
      argsPrefix: ['/usr/local/lib/node_modules/npm/bin/npm-cli.js']
    });
  });

  it('falls back to the running binary when npm_node_execpath is absent', () => {
    expect.hasAssertions();
    const resolved = resolveNpmCommand({
      env: { npm_execpath: '/usr/lib/node_modules/npm/bin/npm-cli.js' },
      execPath: '/usr/bin/node',
      exists: () => false
    });
    expect(resolved.command).toBe('/usr/bin/node');
    expect(resolved.argsPrefix).toStrictEqual(['/usr/lib/node_modules/npm/bin/npm-cli.js']);
  });

  it('ignores npm_execpath pointing at bun (script-compat self-report)', () => {
    expect.hasAssertions();
    const resolved = resolveNpmCommand({
      env: { npm_execpath: '/home/ci/.bun/bin/bun' },
      execPath: '/usr/bin/node',
      exists: (candidate: string) => candidate === '/usr/lib/node_modules/npm/bin/npm-cli.js'
    });
    expect(resolved.argsPrefix).toStrictEqual(['/usr/lib/node_modules/npm/bin/npm-cli.js']);
  });

  it('resolves the npm bundled next to the running node binary', () => {
    expect.hasAssertions();
    const resolved = resolveNpmCommand({
      env: {},
      execPath: '/usr/bin/node',
      exists: (candidate: string) => candidate === '/usr/lib/node_modules/npm/bin/npm-cli.js'
    });
    expect(resolved).toStrictEqual({
      command: '/usr/bin/node',
      argsPrefix: ['/usr/lib/node_modules/npm/bin/npm-cli.js']
    });
  });

  it('walks the fixed install candidates in order', () => {
    expect.hasAssertions();
    const seen: string[] = [];
    const resolved = resolveNpmCommand({
      env: {},
      execPath: '/custom/bin/node',
      exists: (candidate: string) => {
        seen.push(String(candidate));
        return candidate === NPM_INSTALL_CANDIDATES[1];
      }
    });
    expect(resolved.argsPrefix).toStrictEqual([NPM_INSTALL_CANDIDATES[1]]);
    expect(seen).toStrictEqual([
      '/custom/lib/node_modules/npm/bin/npm-cli.js',
      NPM_INSTALL_CANDIDATES[0],
      NPM_INSTALL_CANDIDATES[1]
    ]);
  });

  it('fails closed when no absolute npm CLI resolves', () => {
    expect.hasAssertions();
    expect(() => resolveNpmCommand({
      env: {},
      execPath: '/usr/bin/node',
      exists: () => false
    })).toThrow(/Could not resolve the npm CLI/);
  });

  it('imports without running main (no exit, no npm spawn)', () => {
    expect.hasAssertions();
    expect(process.exitCode).toBeUndefined();
    expect(resolveNpmCommand).toStrictEqual(expect.any(Function));
  });
});

describe('checkNpmOrgAccess (JUM-859)', () => {
  const fakeRunner = (responses: Record<string, string | Error>) => {
    const calls: string[][] = [];
    return {
      calls,
      runCommand: (args: string[]) => {
        calls.push(args);
        const key = args.join(' ');
        const response = responses[key];
        if (response instanceof Error) throw response;
        if (response === undefined) throw new Error(`unexpected args: ${key}`);
        return response;
      }
    };
  };

  it('passes when whoami and org membership both resolve', () => {
    expect.hasAssertions();
    const runner = fakeRunner({
      whoami: 'release-bot',
      [`org ls ${NPM_SCOPE} --json`]: '{"users":["release-bot"]}'
    });
    expect(checkNpmOrgAccess(runner.runCommand)).toBe('release-bot');
    expect(runner.calls).toStrictEqual([
      ['whoami'],
      ['org', 'ls', NPM_SCOPE, '--json']
    ]);
  });

  it('reports unauthenticated when whoami itself fails', () => {
    expect.hasAssertions();
    const runner = fakeRunner({ whoami: new Error('ENEEDAUTH') });
    expect(() => checkNpmOrgAccess(runner.runCommand))
      .toThrow('npm authentication is not configured. Run npm login for the target account.');
  });

  it('reports unresolvable user when whoami answers empty', () => {
    expect.hasAssertions();
    const runner = fakeRunner({ whoami: '' });
    expect(() => checkNpmOrgAccess(runner.runCommand))
      .toThrow('Unable to resolve current npm user.');
  });

  it('reports missing org access when org ls fails', () => {
    expect.hasAssertions();
    const runner = fakeRunner({
      whoami: 'release-bot',
      [`org ls ${NPM_SCOPE} --json`]: new Error('E403')
    });
    expect(() => checkNpmOrgAccess(runner.runCommand))
      .toThrow(`Unable to access ${NPM_SCOPE} org membership. Ensure account has org access.`);
  });

  it('reports unparsable membership when org ls answers non-JSON', () => {
    expect.hasAssertions();
    const runner = fakeRunner({
      whoami: 'release-bot',
      [`org ls ${NPM_SCOPE} --json`]: 'not json at all'
    });
    expect(() => checkNpmOrgAccess(runner.runCommand))
      .toThrow(`Could not parse ${NPM_SCOPE} org members from npm CLI.`);
  });

  it('reports unparsable membership when org ls answers JSON null', () => {
    expect.hasAssertions();
    const runner = fakeRunner({
      whoami: 'release-bot',
      [`org ls ${NPM_SCOPE} --json`]: 'null'
    });
    expect(() => checkNpmOrgAccess(runner.runCommand))
      .toThrow(`Could not parse ${NPM_SCOPE} org members from npm CLI.`);
  });
});
