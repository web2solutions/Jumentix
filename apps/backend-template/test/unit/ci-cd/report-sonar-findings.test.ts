/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs';

/**
 * Printing Sonar's findings into the CI log.
 *
 * A failed quality gate otherwise reports two letters and a link that needs a
 * SonarCloud session, which makes the failure undiagnosable from the artifact
 * that reported it. Requirement `065` treats a check nobody can act on as no
 * better than one that did not run.
 *
 * The step is deliberately advisory — it must never fail a build — so the tests
 * that matter most are the ones proving it stays quiet when it cannot work.
 */
const reporter = require('../../../../../ci-cd/report-sonar-findings') as {
  readTaskMetadata: (contents: string) => Record<string, string>;
  formatIssues: (issues: unknown[]) => string[];
  waitForAnalysis: (
    url: string,
    token: string,
    now?: () => number
  ) => Promise<{ status: string }>;
  main: () => Promise<void>;
  ANALYSIS_TIMEOUT_MS: number;
};

describe('report-sonar-findings', () => {
  it('parses the scanner report-task file', () => {
    expect.hasAssertions();
    // Written by the scanner; the only place the analysis task URL exists.
    const metadata = reporter.readTaskMetadata(
      'projectKey=Jumentix\n'
      + 'serverUrl=https://sonarcloud.io\n'
      + 'ceTaskUrl=https://sonarcloud.io/api/ce/task?id=abc\n'
    );

    expect(metadata.projectKey).toBe('Jumentix');
    expect(metadata.ceTaskUrl).toBe('https://sonarcloud.io/api/ce/task?id=abc');
  });

  it('keeps a value containing an equals sign intact', () => {
    expect.hasAssertions();
    // `ceTaskUrl` always contains `?id=`, so splitting on every `=` would
    // truncate the one field this step cannot work without.
    const metadata = reporter.readTaskMetadata('ceTaskUrl=https://x/api/ce/task?id=a=b');

    expect(metadata.ceTaskUrl).toBe('https://x/api/ce/task?id=a=b');
  });

  it('orders findings worst-first and names file, line and rule', () => {
    expect.hasAssertions();
    // A log that buries a BLOCKER under twenty MINORs is not much better than
    // the link it replaces.
    const lines = reporter.formatIssues([
      {
        type: 'CODE_SMELL',
        severity: 'MINOR',
        component: 'k:src/a.ts',
        line: 3,
        message: 'small',
        rule: 'ts:S1'
      },
      {
        type: 'BUG',
        severity: 'BLOCKER',
        component: 'k:src/b.ts',
        line: 9,
        message: 'big',
        rule: 'ts:S2'
      }
    ]);

    expect(lines[0]).toContain('BUG BLOCKER src/b.ts:9');
    expect(lines[0]).toContain('rule: ts:S2');
    expect(lines[1]).toContain('CODE_SMELL MINOR src/a.ts:3');
  });

  it('reports an issue with no line rather than dropping it', () => {
    expect.hasAssertions();
    // File-level findings have no line. Omitting them would hide exactly the
    // issues that are hardest to locate.
    const [line] = reporter.formatIssues([
      {
        type: 'VULNERABILITY', severity: 'CRITICAL', component: 'k:src/c.ts', message: 'm', rule: 'ts:S3'
      }
    ]);

    expect(line).toContain('src/c.ts');
    expect(line).not.toContain('undefined');
  });

  it('gives up on a stuck analysis instead of polling forever', async () => {
    expect.hasAssertions();
    // A hung task must not hold the job open. The clock is injected so this
    // takes no wall time.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ task: { status: 'PENDING' } })
    })) as never;

    let clock = 0;
    const advancing = () => {
      clock += reporter.ANALYSIS_TIMEOUT_MS;
      return clock;
    };

    await expect(reporter.waitForAnalysis('https://x', 'token', advancing))
      .rejects.toThrow('did not finish');

    globalThis.fetch = originalFetch;
  });

  describe('without a token', () => {
    const previousToken = process.env.SONAR_TOKEN;

    beforeEach(() => {
      delete process.env.SONAR_TOKEN;
    });

    afterEach(() => {
      delete process.env.SONAR_TOKEN;
      Object.assign(
        process.env,
        previousToken === undefined ? {} : { SONAR_TOKEN: previousToken }
      );
    });

    it('says nothing and exits cleanly', async () => {
      expect.hasAssertions();
      // The step runs on every Sonar job, including forks and local runs where
      // no token exists. Failing there would block merges over a reporting
      // nicety.
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

      await expect(reporter.main()).resolves.toBeUndefined();
      expect(log.mock.calls.flat().join('\n')).toContain('SONAR_TOKEN is not set');

      log.mockRestore();
    });
  });

  it('says nothing when the scanner did not run here', async () => {
    expect.hasAssertions();
    // `.scannerwork/report-task.txt` only exists after a scan. Its absence is
    // the normal state on every job that is not the Sonar one.
    process.env.SONAR_TOKEN = 'token-for-this-test';
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(reporter.main()).resolves.toBeUndefined();
    expect(log.mock.calls.flat().join('\n')).toContain('scanner did not run here');

    exists.mockRestore();
    log.mockRestore();
    delete process.env.SONAR_TOKEN;
  });
});

/**
 * Which scope the report queries.
 *
 * This is the part that failed silently the first time. Without a pull-request
 * key the API returns the *project's* issues — every open finding on the
 * long-lived branch — which reads exactly like a PR report and is not one. It
 * printed a hundred findings whose line numbers had nothing to do with the code
 * under review, and looked entirely plausible doing it.
 */
describe('report-sonar-findings pull-request scope', () => {
  const resolve = (
    reporter as unknown as {
      resolvePullRequestKey: (
        metadata: Record<string, string>,
        env: Record<string, string>
      ) => string | null;
    }
  ).resolvePullRequestKey;

  it('prefers an explicit key', () => {
    expect.hasAssertions();
    expect(resolve({}, { SONAR_PULL_REQUEST_KEY: '15' })).toBe('15');
  });

  it('reads the key the scanner recorded', () => {
    expect.hasAssertions();
    expect(resolve({ pullRequest: '15' }, {})).toBe('15');
  });

  it('derives the key from a GitHub pull-request ref', () => {
    expect.hasAssertions();
    // What Actions actually sets on a PR run, and what was missing.
    expect(resolve({}, { GITHUB_REF: 'refs/pull/15/merge' })).toBe('15');
  });

  it('derives the key from a CircleCI pull-request URL', () => {
    expect.hasAssertions();
    expect(resolve({}, { CIRCLE_PULL_REQUEST: 'https://github.com/o/r/pull/15' })).toBe('15');
  });

  it('is null on a branch build rather than guessing', () => {
    expect.hasAssertions();
    // A branch analysis has no PR, and reporting the project's issues there is
    // correct — but only because the log says so. Returning a wrong key would
    // query an unrelated PR.
    expect(resolve({}, { GITHUB_REF: 'refs/heads/dev' })).toBeNull();
    expect(resolve({}, {})).toBeNull();
  });
});
