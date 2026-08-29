/* eslint-disable @typescript-eslint/no-var-requires */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Requirement 111 — only declared identities may author or commit here.
 *
 * The checker is what stands between a personal or corporate address and a
 * permanent public record of it, so most of this suite is about making it fail.
 * A checker only ever observed passing is indistinguishable from one that always
 * passes (Requirement 065), and this one is especially easy to get wrong in the
 * passing direction: an empty commit range, an empty allowlist and a missing git
 * binary all produce "no violations found" if the failure paths are not written
 * deliberately.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const checkerPath = path.join(repoRoot, 'ci-cd', 'check-commit-authorship.js');
const {
  DECLARATION_PATH,
  FULL_HISTORY,
  checkConfiguredIdentity,
  main,
  parseDeclaration,
  run,
  runAsEntryPoint,
  unauthorizedCommits
} = require(checkerPath);

const CUTOFF = '0'.repeat(40);
const US = String.fromCharCode(0x1f);

/** A declaration with the given addresses and a valid cutoff. */
function declaration(emails: string[]): string {
  return JSON.stringify({
    historyCutoff: { commit: CUTOFF },
    identities: emails.map((email) => ({ email, kind: 'human' }))
  });
}

/** A fake `git log` returning the given commits in the checker's own format. */
function gitReturning(
  commits: Array<{ sha: string; author: string; committer?: string }>
): () => string {
  return () => commits
    .map((commit) => [
      commit.sha,
      'Some Name',
      commit.author,
      'Some Name',
      commit.committer ?? commit.author
    ].join(US))
    .join('\n');
}

/** A fake `git var`, which returns "Name <email> <timestamp> <offset>". */
function identReturning(author: string, committer?: string) {
  const asCommitter = committer ?? author;
  return (args: string[]) => (args[1] === 'GIT_AUTHOR_IDENT'
    ? `Someone <${author}> 1700000000 +0000`
    : `Someone <${asCommitter}> 1700000000 +0000`);
}

function runWith(options: {
  emails?: string[];
  declarationText?: string;
  commits?: Array<{ sha: string; author: string; committer?: string }>;
  runGit?: () => string;
}) {
  return run({
    readFile: () => options.declarationText ?? declaration(options.emails ?? ['ok@example.com']),
    runGit: options.runGit ?? gitReturning(options.commits ?? [])
  });
}

/**
 * An environment with every `GIT_*` variable removed.
 *
 * Not a nicety. This suite runs inside `ci:gate`, which runs from the
 * `pre-commit` hook — and git exports `GIT_AUTHOR_*`, `GIT_COMMITTER_*`,
 * `GIT_DIR` and `GIT_INDEX_FILE` to hook processes. Inheriting those made the
 * fixture's commits take the *hook's* identity instead of the one configured
 * here, so both fixture commits counted as violations and the assertion below
 * failed — but only when run from a hook, never when run directly.
 *
 * `GIT_DIR` and `GIT_INDEX_FILE` are the serious half: left in place they point
 * this fixture's `git init` and `git commit` at the real repository.
 */
function hermeticGitEnv(): NodeJS.ProcessEnv {
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('GIT_')) env[key] = value;
  }
  // Ignore the machine's own git configuration too, so the fixture's declared
  // identity is the only one in play.
  env.GIT_CONFIG_GLOBAL = '/dev/null';
  env.GIT_CONFIG_SYSTEM = '/dev/null';
  return env as NodeJS.ProcessEnv;
}

/** Run the checker as a process, capturing the exit code either way. */
function runChecker(workingDirectory: string): { code: number; output: string } {
  try {
    const output = execFileSync('bun', [checkerPath], {
      cwd: workingDirectory, encoding: 'utf8', stdio: 'pipe', env: hermeticGitEnv()
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`
    };
  }
}

describe('check-commit-authorship', () => {
  describe('identity enforcement', () => {
    it('passes when every author and committer is declared', () => {
      expect.hasAssertions();

      const result = runWith({
        emails: ['ok@example.com'],
        commits: [{ sha: 'a'.repeat(40), author: 'ok@example.com' }]
      });

      expect(result.ok).toBe(true);
    });

    it('fails on an undeclared author', () => {
      expect.hasAssertions();

      const result = runWith({
        emails: ['ok@example.com'],
        commits: [{ sha: 'b'.repeat(40), author: 'stranger@elsewhere.test' }]
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('stranger@elsewhere.test');
      expect(result.message).toContain('author');
    });

    /**
     * The case a one-role check misses. Author and committer diverge on exactly
     * the operations that rewrite identity — rebase, amend, cherry-pick, web
     * merge — so a check reading only the author leaves the other field free to
     * carry anything.
     */
    it('fails on an undeclared committer even when the author is declared', () => {
      expect.hasAssertions();

      const result = runWith({
        emails: ['ok@example.com'],
        commits: [{
          sha: 'c'.repeat(40),
          author: 'ok@example.com',
          committer: 'stranger@elsewhere.test'
        }]
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('committer');
      expect(result.message).toContain('stranger@elsewhere.test');
    });

    it('compares addresses case-insensitively', () => {
      expect.hasAssertions();

      const result = runWith({
        emails: ['ok@example.com'],
        commits: [{ sha: 'd'.repeat(40), author: 'OK@Example.COM' }]
      });

      expect(result.ok).toBe(true);
    });

    it('reports every offending commit, not just the first', () => {
      expect.hasAssertions();

      const result = runWith({
        emails: ['ok@example.com'],
        commits: [
          { sha: 'e'.repeat(40), author: 'one@elsewhere.test' },
          { sha: 'f'.repeat(40), author: 'two@elsewhere.test' }
        ]
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('2 commit(s)');
      expect(result.message).toContain('one@elsewhere.test');
      expect(result.message).toContain('two@elsewhere.test');
    });
  });

  describe('failing closed', () => {
    it('fails when the declaration is missing', () => {
      expect.hasAssertions();

      const result = run({
        readFile: () => { throw new Error('ENOENT: no such file'); },
        runGit: gitReturning([])
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('Requirement 111');
    });

    it('fails when the declaration is not valid JSON', () => {
      expect.hasAssertions();

      const result = runWith({ declarationText: '{ not json' });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('not valid JSON');
    });

    /**
     * The quiet way to disable this check: leave the file in place and empty the
     * list. It parses, it iterates, and it matches nothing.
     */
    it('fails when the identity list is empty', () => {
      expect.hasAssertions();

      const result = runWith({
        declarationText: JSON.stringify({ historyCutoff: { commit: CUTOFF }, identities: [] })
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('declares no identities');
    });

    it('fails when an identity has no email', () => {
      expect.hasAssertions();

      const result = runWith({
        declarationText: JSON.stringify({
          historyCutoff: { commit: CUTOFF },
          identities: [{ kind: 'human', note: 'someone' }]
        })
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('no email');
    });

    /**
     * Without a cutoff the scope is undefined, and an undefined scope reads as a
     * clean bill of health for history the check never looked at. A ref name is
     * rejected along with a short SHA: both resolve differently depending on
     * where and when the check runs.
     */
    it.each([
      ['absent', {}],
      ['a ref name', { commit: 'HEAD~5' }],
      ['a short SHA', { commit: 'abc123' }],
      ['lowercase root', { commit: 'root' }]
    ])('fails when the history cutoff is %s', (_label, historyCutoff) => {
      expect.hasAssertions();

      const result = runWith({
        declarationText: JSON.stringify({
          historyCutoff,
          identities: [{ email: 'ok@example.com' }]
        })
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('historyCutoff');
    });

    /**
     * `ROOT` is the state the repository is in after the identity rewrite: no
     * exemption at all. It is a distinct accepted value rather than an absent
     * field, so "verify everything" is something the declaration states rather
     * than something the check assumes when a field is missing.
     */
    it('accepts ROOT and asks git for the whole history', () => {
      expect.hasAssertions();

      const ranges: string[] = [];
      const result = run({
        readFile: () => JSON.stringify({
          historyCutoff: { commit: FULL_HISTORY },
          identities: [{ email: 'ok@example.com' }]
        }),
        runGit: (args: string[]) => {
          ranges.push(args[1]);
          return '';
        }
      });

      expect(result.ok).toBe(true);
      // `HEAD`, not `<sha>..HEAD` — the root commit is included.
      expect(ranges).toStrictEqual(['HEAD']);
      expect(result.message).toContain('entire history');
    });

    it('asks git only for the range after a declared cutoff', () => {
      expect.hasAssertions();

      const ranges: string[] = [];
      run({
        readFile: () => declaration(['ok@example.com']),
        runGit: (args: string[]) => {
          ranges.push(args[1]);
          return '';
        }
      });

      expect(ranges).toStrictEqual([`${CUTOFF}..HEAD`]);
    });

    it('fails when git cannot be read rather than reporting no violations', () => {
      expect.hasAssertions();

      const result = runWith({
        runGit: () => { throw new Error('not a git repository'); }
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('not a git repository');
    });
  });

  /**
   * The pre-commit mode. It exists because the range check structurally cannot
   * cover the commit being written: at pre-commit time that commit is not in
   * `cutoff..HEAD`, so the range check passes and the undeclared commit is
   * created regardless.
   */
  describe('configured identity (--identity)', () => {
    it('passes when the configured identity is declared', () => {
      expect.hasAssertions();

      const result = checkConfiguredIdentity({
        readFile: () => declaration(['ok@example.com']),
        runGit: identReturning('ok@example.com')
      });

      expect(result.ok).toBe(true);
    });

    it('fails when the configured author is undeclared', () => {
      expect.hasAssertions();

      const result = checkConfiguredIdentity({
        readFile: () => declaration(['ok@example.com']),
        runGit: identReturning('stranger@elsewhere.test')
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('stranger@elsewhere.test');
    });

    it('fails when only the committer is undeclared', () => {
      expect.hasAssertions();

      const result = checkConfiguredIdentity({
        readFile: () => declaration(['ok@example.com']),
        runGit: identReturning('ok@example.com', 'stranger@elsewhere.test')
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('committer');
    });

    /**
     * Requirement 111 §7 leaves no global identity configured, so an
     * unconfigured repository is the expected state — and it must stop the
     * commit rather than wave it through.
     */
    it('fails closed when git cannot resolve an identity at all', () => {
      expect.hasAssertions();

      const result = checkConfiguredIdentity({
        readFile: () => declaration(['ok@example.com']),
        runGit: () => { throw new Error('unable to auto-detect email address'); }
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('git config user.email');
    });

    /**
     * `git var` is expected to return "Name <email> …". If it ever returns
     * something else, the address parses as empty — which must read as
     * undeclared, not as a match against an allowlist that happens to be missing
     * the empty string.
     */
    it('treats an unparseable identity as undeclared', () => {
      expect.hasAssertions();

      const result = checkConfiguredIdentity({
        readFile: () => declaration(['ok@example.com']),
        runGit: () => 'no angle brackets here'
      });

      expect(result.ok).toBe(false);
      expect(result.message).toContain('author <>');
    });

    it('fails closed when the declaration is unreadable', () => {
      expect.hasAssertions();

      const result = checkConfiguredIdentity({
        readFile: () => { throw new Error('ENOENT'); },
        runGit: identReturning('ok@example.com')
      });

      expect(result.ok).toBe(false);
    });
  });

  /**
   * Mode dispatch. Wiring a flag to the wrong mode is silent — both modes report
   * in the same shape, and the wrong one still exits zero on a clean repository.
   */
  describe('main', () => {
    function recorder() {
      const logged: string[] = [];
      const io = {
        log: (message: string) => logged.push(message),
        error: (message: string) => logged.push(message)
      };
      return { io, logged };
    }

    it('runs the range check by default and returns 0 when it passes', () => {
      expect.hasAssertions();

      const { io, logged } = recorder();
      const code = main([], io, {
        run: () => ({ ok: true, message: 'range mode' }),
        checkConfiguredIdentity: () => ({ ok: true, message: 'identity mode' })
      });

      expect(code).toBe(0);
      expect(logged).toStrictEqual(['range mode']);
    });

    it('runs the identity check when --identity is passed', () => {
      expect.hasAssertions();

      const { io, logged } = recorder();
      const code = main(['bun', 'checker', '--identity'], io, {
        run: () => ({ ok: true, message: 'range mode' }),
        checkConfiguredIdentity: () => ({ ok: true, message: 'identity mode' })
      });

      expect(code).toBe(0);
      expect(logged).toStrictEqual(['identity mode']);
    });

    it('returns 1 and reports the message on failure', () => {
      expect.hasAssertions();

      const { io, logged } = recorder();
      const code = main([], io, { run: () => ({ ok: false, message: 'nope' }) });

      expect(code).toBe(1);
      expect(logged).toStrictEqual(['nope']);
    });
  });

  /**
   * The guard that decides whether the check runs at all. Inline as
   * `if (isEntryPoint(module))` it is unreachable from any suite — under a test
   * runner this file is always imported — so the decision would go unverified.
   */
  describe('runAsEntryPoint', () => {
    it('does nothing when the module is merely imported', () => {
      expect.hasAssertions();

      const exits: number[] = [];
      const ran = runAsEntryPoint({
        caller: { id: 'imported' },
        entry: { id: 'something-else' },
        exit: (code: number) => exits.push(code),
        runMain: () => 0
      });

      expect(ran).toBe(false);
      expect(exits).toStrictEqual([]);
    });

    it('runs the check and reports the exit code when it is the entry point', () => {
      expect.hasAssertions();

      const exits: number[] = [];
      // `isEntryPoint` accepts exactly one identity: the module that is itself
      // the process entry point, so passing the same object as both is what
      // being the entry point means. Supplied explicitly because under a test
      // runner the real `require.main` is the runner, never this file.
      const entry = { id: 'the-entry-point' };
      const ran = runAsEntryPoint({
        caller: entry,
        entry,
        exit: (code: number) => exits.push(code),
        runMain: () => 3
      });

      expect(ran).toBe(true);
      // The exit code is whatever the check returned, passed through unchanged.
      expect(exits).toStrictEqual([3]);
    });

    /**
     * The default `exit` is what actually decides the process's fate in the hook
     * and in CI, so it is exercised rather than replaced. A passing result is
     * used deliberately: it sets `process.exitCode` to 0, which is already its
     * value, so the assertion cannot leave this suite reporting a failure.
     */
    it('reports through process.exitCode by default', () => {
      expect.hasAssertions();

      const previous = process.exitCode;
      const entry = { id: 'the-entry-point' };

      try {
        const ran = runAsEntryPoint({ caller: entry, entry, runMain: () => 0 });

        expect(ran).toBe(true);
        expect(process.exitCode).toBe(0);
      } finally {
        process.exitCode = previous;
      }
    });
  });

  /**
   * With nothing injected, both modes resolve their own declaration reader and
   * shell out to the real git — the path that actually runs in the hook and in
   * CI, and the one every other test in this file replaces.
   *
   * Shape, not verdict. Asserting `ok === true` here would make the unit suite
   * fail whenever the repository's own history is non-compliant or the clone is
   * too shallow to reach the cutoff — a real condition, but one the gate already
   * reports through `governance:check-authorship`. Duplicating it here would add
   * a confusing second failure site without adding protection.
   */
  describe('default wiring', () => {
    it('resolves its own dependencies when nothing is injected', () => {
      expect.hasAssertions();

      for (const result of [run(), checkConfiguredIdentity()]) {
        expect(typeof result.ok).toBe('boolean');
        expect(typeof result.message).toBe('string');
      }
    });

    it('dispatches through the real defaults when main is called bare', () => {
      expect.hasAssertions();

      const logged: string[] = [];
      const errors: string[] = [];
      const logSpy = jest.spyOn(console, 'log').mockImplementation((message) => {
        logged.push(String(message));
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation((message) => {
        errors.push(String(message));
      });

      try {
        const status = main();

        expect([0, 1]).toContain(status);
        expect([...logged, ...errors].join('\n')).toContain('Commit authorship check');
      } finally {
        logSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  describe('parseDeclaration', () => {
    it('lowercases and trims declared addresses', () => {
      expect.hasAssertions();

      const parsed = parseDeclaration(JSON.stringify({
        historyCutoff: { commit: CUTOFF },
        identities: [{ email: '  Mixed@Case.Test  ' }]
      }));

      expect(parsed.emails.has('mixed@case.test')).toBe(true);
    });
  });

  describe('unauthorizedCommits', () => {
    it('treats a commit with no email at all as unauthorized', () => {
      expect.hasAssertions();

      const violations = unauthorizedCommits(
        [{ sha: 'a'.repeat(40), authorEmail: '', committerEmail: '' }],
        new Set(['ok@example.com'])
      );

      expect(violations).toHaveLength(1);
    });
  });

  /**
   * The end-to-end proof. Everything above injects a fake git, which verifies the
   * logic but not that the checker reads real history correctly — a wrong
   * `--format` or a bad range would pass every test above and report success on
   * any repository.
   */
  describe('against a real repository', () => {
    let workdir: string;

    beforeAll(() => {
      workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'authorship-'));

      const git = (...args: string[]) => execFileSync('git', args, {
        cwd: workdir,
        encoding: 'utf8',
        env: hermeticGitEnv()
      });

      git('init', '-q', '-b', 'main');

      // Refuse to go further unless git is operating on the throwaway tree.
      //
      // Belt and braces over `hermeticGitEnv`, and not hypothetical: an earlier
      // revision of this fixture inherited `GIT_DIR` from the pre-commit hook,
      // so `git config` and `git commit` here rewrote the identity of the real
      // repository and left three fixture commits on the working branch. A
      // fixture that can reach outside its own directory must say so loudly
      // rather than corrupt the tree it is running in.
      const toplevel = fs.realpathSync(git('rev-parse', '--show-toplevel').trim());
      if (toplevel !== fs.realpathSync(workdir)) {
        throw new Error(`fixture escaped its temporary directory: git is operating on ${toplevel}`);
      }

      git('config', 'user.name', 'Declared Person');
      git('config', 'user.email', 'declared@example.com');
      git('commit', '-q', '--allow-empty', '-m', 'cutoff');

      const cutoffSha = git('rev-parse', 'HEAD').trim();

      git('commit', '-q', '--allow-empty', '-m', 'good');
      git('config', 'user.email', 'undeclared@elsewhere.test');
      git('commit', '-q', '--allow-empty', '-m', 'bad');

      fs.mkdirSync(path.join(workdir, '.agents'), { recursive: true });
      fs.writeFileSync(
        path.join(workdir, DECLARATION_PATH),
        JSON.stringify({
          historyCutoff: { commit: cutoffSha },
          identities: [{ email: 'declared@example.com', kind: 'human' }]
        })
      );
    });

    afterAll(() => {
      fs.rmSync(workdir, { recursive: true, force: true });
    });

    it('exits non-zero and names only the offending commit', () => {
      expect.hasAssertions();

      const { code, output } = runChecker(workdir);

      expect(code).toBe(1);
      expect(output).toContain('undeclared@elsewhere.test');
      // The commit before it is by a declared identity and must not be reported,
      // and the commit at the cutoff is outside the range entirely.
      expect(output).toContain('1 commit(s)');
    });
  });
});

/**
 * The CLI's two modes, and what each exits with (JUM-681).
 *
 * `--identity` validates what the *next* commit would be stamped with; the
 * default validates the commits that already exist. Wiring the wrong one to a
 * hook is a silent hole — the flag would still print a reassuring line — so both
 * dispatch paths and both exit codes are asserted here.
 */
describe('check-commit-authorship CLI (JUM-681)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const authorship = require('../../../../../ci-cd/check-commit-authorship') as {
    main: (
      argv: string[],
      io: { log: (m: string) => void; error: (m: string) => void },
      options?: Record<string, unknown>
    ) => number;
  };

  const collect = () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const io = {
      log: (m: string) => logs.push(m),
      error: (m: string) => errors.push(m)
    };
    return { io, logs, errors };
  };

  it('validates the configured identity when asked, and exits 0 on success', () => {
    expect.hasAssertions();

    const { io, logs } = collect();
    const status = authorship.main(['bun', 'check', '--identity'], io, {
      checkConfiguredIdentity: () => ({ ok: true, message: 'identity is authorized' }),
      run: () => ({ ok: false, message: 'history check must not run here' })
    });

    expect(status).toBe(0);
    expect(logs).toStrictEqual(['identity is authorized']);
  });

  it('validates the existing history by default, and exits 1 on failure', () => {
    expect.hasAssertions();

    const { io, errors } = collect();
    const status = authorship.main(['bun', 'check'], io, {
      checkConfiguredIdentity: () => ({ ok: true, message: 'identity check must not run here' }),
      run: () => ({ ok: false, message: 'unauthorized author in history' })
    });

    expect(status).toBe(1);
    expect(errors).toStrictEqual(['unauthorized author in history']);
  });
});
