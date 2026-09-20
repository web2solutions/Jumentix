/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook */
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Requirement 112 — this package owns its suite.
 *
 * It previously had none. What stood in for one was a twelve-line file three
 * workspaces away, in the backend application, asserting a single constant; and
 * a `test` script that ran `jumentix-init --help` and called a zero exit code a
 * pass. This is the tool that scaffolds every new service from this template,
 * so the first thing anyone runs is the least tested thing in the repository.
 *
 * Nothing here is faked. The clone runs the real `git` against a real
 * repository created on disk under the OS temp directory, and the profile it
 * writes is read back off the filesystem. `runCommand` is a parameter only so
 * the tests that are not about cloning do not have to clone; the test that is
 * about cloning uses the real one.
 */

require('./ensure-built');

const bootstrap = require('../dist/legacy/bootstrap');

const {
  BOILERPLATE_REPOSITORY,
  SERVICE_TYPES,
  chooseServiceType,
  createPrompt,
  ensureTargetFolderIsEmpty,
  environmentWithoutRepositoryLocation,
  GIT_LOCATION_VARIABLES,
  parseCliArgs,
  printHelp,
  resolveServiceTypeById,
  run,
  runCommand,
  toAbsolute,
  writeBootstrapProfile
} = bootstrap;

/** Scratch directories created by a test, removed when it ends. */
const created: string[] = [];

function scratch(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cli-init-${prefix}-`));
  created.push(dir);
  return dir;
}

const restoreProcessProperty = (
  name: 'stdin' | 'stdout',
  previous: PropertyDescriptor | undefined
): void => {
  if (previous) {
    Object.defineProperty(process, name, previous);
    return;
  }

  delete (process as unknown as Record<string, unknown>)[name];
};

// A file-level hook, deliberately: every scratch directory in this file is
// removed by the same teardown, and per-describe copies would be four chances
// to leave one behind in the OS temp directory.
// eslint-disable-next-line jest/require-top-level-describe
afterEach(() => {
  while (created.length > 0) {
    fs.rmSync(created.pop() as string, { recursive: true, force: true });
  }
});

/**
 * A git repository on disk, to clone from.
 *
 * The environment is stripped of every `GIT_*` variable first. Without that,
 * a git command run from inside a hook inherits `GIT_DIR` and `GIT_WORK_TREE`
 * from the invoking process and writes into *this* repository instead of the
 * fixture — which is not hypothetical; it happened, and it committed.
 */
function gitRepository(branch = 'main'): string {
  const dir = scratch('origin');
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
  ) as NodeJS.ProcessEnv;
  const git = (...args: string[]) => execFileSync('/usr/bin/git', args, { cwd: dir, env, stdio: 'pipe' });

  git('init', '--quiet', `--initial-branch=${branch}`);
  git('config', 'user.email', 'web2solucoes@gmail.com');
  git('config', 'user.name', 'Fixture');
  fs.writeFileSync(path.join(dir, 'README.md'), 'template\n', 'utf8');
  git('add', '.');
  git('commit', '--quiet', '--no-gpg-sign', '-m', 'template');

  return dir;
}

/** Records the calls a test does not want to actually perform. */
function recorder() {
  const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
  return {
    calls,
    execute: (command: string, args: string[], cwd: string) => {
      calls.push({ command, args, cwd });
    }
  };
}

/** Answers prompts from a script, in order. */
function answers(...scripted: string[]) {
  const remaining = [...scripted];
  let closed = 0;
  return {
    closeCount: () => closed,
    createPrompt: () => ({
      ask: async () => remaining.shift() ?? '',
      close: () => { closed += 1; }
    })
  };
}

const lines = () => {
  const out: string[] = [];
  return { out, log: (message: string) => out.push(String(message)) };
};

describe('argument parsing', () => {
  it('defaults every option when given nothing', () => {
    expect.hasAssertions();

    expect(parseCliArgs([])).toStrictEqual({
      help: false,
      nonInteractive: false,
      serviceTypeId: '',
      projectName: '',
      gitBranch: '',
      installDeps: undefined,
      repository: ''
    });
  });

  it.each(['--help', '-h'])('recognises %s', (flag: string) => {
    expect.hasAssertions();

    expect(parseCliArgs([flag]).help).toBe(true);
  });

  it('reads every value option', () => {
    expect.hasAssertions();

    expect(parseCliArgs([
      '--non-interactive',
      '--service-type=grpc',
      '--project-name=svc',
      '--git-branch=release',
      '--repo=https://example.test/x.git'
    ])).toMatchObject({
      nonInteractive: true,
      serviceTypeId: 'grpc',
      projectName: 'svc',
      gitBranch: 'release',
      repository: 'https://example.test/x.git'
    });
  });

  /**
   * `--install-deps` decides whether a subprocess runs, so what counts as yes
   * is worth pinning rather than inferring from the implementation.
   */
  it.each([
    ['y', true], ['yes', true], ['true', true], ['1', true], ['Y', true], ['TRUE', true],
    ['n', false], ['no', false], ['false', false], ['0', false], ['', false], ['maybe', false]
  ])('reads --install-deps=%s as %s', (value: string, expected: boolean) => {
    expect.hasAssertions();

    expect(parseCliArgs([`--install-deps=${value}`]).installDeps).toBe(expected);
  });

  it('ignores an argument it does not recognise', () => {
    expect.hasAssertions();

    expect(parseCliArgs(['--nonsense=1', '--project-name=svc']).projectName).toBe('svc');
  });

  it('treats an option given without a value as absent', () => {
    expect.hasAssertions();

    expect(parseCliArgs(['--project-name=', '--repo=', '--git-branch=', '--service-type='])).toMatchObject({
      projectName: '',
      repository: '',
      gitBranch: '',
      serviceTypeId: ''
    });
  });
});

const serviceTypeIds: string[] = SERVICE_TYPES.map((type: { id: string }) => type.id);

describe('service types', () => {
  it.each(serviceTypeIds)('resolves %s', (id: string) => {
    expect.hasAssertions();

    expect(resolveServiceTypeById(id).id).toBe(id);
  });

  it('refuses an id it does not know', () => {
    expect.hasAssertions();

    expect(() => resolveServiceTypeById('carrier-pigeon'))
      .toThrow('Invalid service type "carrier-pigeon".');
  });

  it('lists every choice before asking', async () => {
    expect.hasAssertions();

    const { out, log } = lines();
    const chosen = await chooseServiceType(async () => '1', log);

    expect(chosen).toStrictEqual(SERVICE_TYPES[0]);
    expect(out.filter((line) => line.includes('. '))).toHaveLength(SERVICE_TYPES.length);
  });

  it('accepts the last number in the list', async () => {
    expect.hasAssertions();

    const chosen = await chooseServiceType(async () => String(SERVICE_TYPES.length), () => {});

    expect(chosen).toStrictEqual(SERVICE_TYPES[SERVICE_TYPES.length - 1]);
  });

  /** Off-by-one either way scaffolds the wrong service, silently. */
  it.each(['0', String(SERVICE_TYPES.length + 1), '-1', 'two', '', '1.5'])(
    'rejects the selection %p',
    async (selection: string) => {
      expect.hasAssertions();

      await expect(chooseServiceType(async () => selection, () => {}))
        .rejects.toThrow('Invalid service type selection.');
    }
  );
});

describe('the target folder', () => {
  it('accepts a path that does not exist', () => {
    expect.hasAssertions();

    expect(() => ensureTargetFolderIsEmpty(path.join(scratch('target'), 'new'))).not.toThrow();
  });

  it('accepts a folder that exists and is empty', () => {
    expect.hasAssertions();

    expect(() => ensureTargetFolderIsEmpty(scratch('empty'))).not.toThrow();
  });

  /**
   * The one that matters: cloning into a folder with someone's work in it.
   * `git clone` would refuse, but only after the CLI has already told the user
   * it was cloning — and the check is what keeps the failure legible.
   */
  it('refuses a folder that already holds something', () => {
    expect.hasAssertions();

    const dir = scratch('occupied');
    fs.writeFileSync(path.join(dir, 'work.txt'), 'mine', 'utf8');

    expect(() => ensureTargetFolderIsEmpty(dir)).toThrow('already exists and is not empty');
  });

  it('resolves a relative path against the working directory it is given', () => {
    expect.hasAssertions();

    expect(toAbsolute('svc', '/base')).toBe(path.resolve('/base', 'svc'));
  });

  it('leaves an absolute path alone', () => {
    expect.hasAssertions();

    expect(toAbsolute('/already/absolute', '/base')).toBe('/already/absolute');
  });

  it('falls back to the process working directory', () => {
    expect.hasAssertions();

    expect(toAbsolute('svc')).toBe(path.resolve(process.cwd(), 'svc'));
  });
});

describe('the profile file', () => {
  it('writes readable JSON under .jumentix, creating the folder', () => {
    expect.hasAssertions();

    const dir = scratch('profile');
    writeBootstrapProfile(dir, { serviceType: 'rest' });

    const written = fs.readFileSync(path.join(dir, '.jumentix', 'service-profile.json'), 'utf8');

    expect(JSON.parse(written)).toStrictEqual({ serviceType: 'rest' });
    // Trailing newline: the file is read by humans and by `cat`.
    expect(written.endsWith('\n')).toBe(true);
  });
});

describe('runCommand', () => {
  /**
   * `/bin/sh`, not `git`: the assertion is about the working directory, and a
   * git subprocess would take its directory from `GIT_DIR` when one is set in
   * the environment — testing git's environment handling rather than this
   * function's `cwd` argument.
   */
  it('runs the command in the directory it is given', () => {
    expect.hasAssertions();

    const dir = scratch('run');

    expect(() => runCommand('/bin/sh', ['-c', 'pwd > where.txt'], dir)).not.toThrow();
    expect(fs.readFileSync(path.join(dir, 'where.txt'), 'utf8').trim())
      .toBe(fs.realpathSync(dir));
  });

  /**
   * A failed clone must stop the scaffold. Swallowed, it would leave a folder
   * holding a profile describing a project whose source was never fetched.
   */
  it('throws with the command and its exit code when it fails', () => {
    expect.hasAssertions();

    expect(() => runCommand('/bin/sh', ['-c', 'exit 3'], scratch('fail')))
      .toThrow('/bin/sh -c exit 3 failed with exit code 3');
  });
});

describe('the environment git is given', () => {
  /**
   * The bug this pins is not hypothetical. This suite once ran git through
   * `runCommand` while the repository's own pre-commit hook had GIT_DIR
   * exported; git reinitialised the repository being committed to, wrote
   * `bare = true` into its config and left its index unreadable.
   *
   * A scaffold clones into a new folder. Where the caller's repository happens
   * to be is none of its business.
   */
  it.each(GIT_LOCATION_VARIABLES as string[])('drops %s', (name: string) => {
    expect.hasAssertions();

    expect(environmentWithoutRepositoryLocation({ [name]: '/somewhere/.git', PATH: '/usr/bin' }))
      .toStrictEqual({ PATH: '/usr/bin' });
  });

  /**
   * The other half, and the one easy to get wrong by reaching for a blanket
   * `GIT_*` filter: these are how a user reaches a private template, and
   * dropping them breaks the clone rather than protecting it.
   */
  it.each(['GIT_SSH_COMMAND', 'GIT_ASKPASS', 'GIT_TERMINAL_PROMPT', 'GIT_CONFIG_GLOBAL'])(
    'keeps %s',
    (name: string) => {
      expect.hasAssertions();

      expect(environmentWithoutRepositoryLocation({ [name]: 'value' })).toStrictEqual({ [name]: 'value' });
    }
  );

  it('leaves the process environment untouched', () => {
    expect.hasAssertions();

    const source = { GIT_DIR: '/somewhere/.git', PATH: '/usr/bin' };
    environmentWithoutRepositoryLocation(source);

    // A copy, not a mutation: the caller's own git still works afterwards.
    expect(source).toStrictEqual({ GIT_DIR: '/somewhere/.git', PATH: '/usr/bin' });
  });

  it('reads the process environment when given none', () => {
    expect.hasAssertions();

    expect(environmentWithoutRepositoryLocation()).not.toHaveProperty('GIT_DIR');
  });
});

describe('createPrompt', () => {
  /**
   * A real `readline` interface over a pair of pipes — the same code path
   * production takes over stdin and stdout.
   */
  it('reads an answer and trims it', async () => {
    expect.hasAssertions();

    const input = new PassThrough();
    const output = new PassThrough();
    const prompt = createPrompt({ input, output });

    const asked = prompt.ask('name: ');
    input.write('  spaced  \n');

    await expect(asked).resolves.toBe('spaced');

    prompt.close();
  });

  it('answers an empty line as an empty string', async () => {
    expect.hasAssertions();

    const input = new PassThrough();
    const prompt = createPrompt({ input, output: new PassThrough() });

    const asked = prompt.ask('name: ');
    input.write('\n');

    await expect(asked).resolves.toBe('');

    prompt.close();
  });
});

describe('printHelp', () => {
  it('names every option the parser understands', () => {
    expect.hasAssertions();

    const { out, log } = lines();
    printHelp(log);
    const help = out.join('\n');

    // Undocumented flags are flags nobody uses.
    for (const flag of [
      '--help', '--non-interactive', '--service-type', '--project-name',
      '--git-branch', '--install-deps', '--repo'
    ]) {
      expect(help).toContain(flag);
    }
  });
});

/**
 * The default `log` is `console.log`, and a default nobody exercises is a
 * default nobody has checked. `console` is a global object, so swapping the
 * method and putting it back works identically under both runners — unlike
 * module substitution (JUM-583).
 */
describe('the console default', () => {
  /* eslint-disable no-console -- the console is the subject here, not a leftover. */
  function capturingConsole<T>(body: () => T): { result: T; out: string[] } {
    const out: string[] = [];
    const original = console.log;
    console.log = (message?: unknown) => { out.push(String(message)); };

    try {
      return { result: body(), out };
    } finally {
      console.log = original;
    }
  }

  it('prints help to the console when given no logger', () => {
    expect.hasAssertions();

    const { out } = capturingConsole(() => printHelp());

    expect(out.join('\n')).toContain('Jumentix Bootstrap CLI');
  });

  it('lists the service types on the console when given no logger', async () => {
    expect.hasAssertions();

    const out: string[] = [];
    const original = console.log;
    console.log = (message?: unknown) => { out.push(String(message)); };

    try {
      await chooseServiceType(async () => '1');
    } finally {
      console.log = original;
    }

    expect(out.filter((line) => line.includes('. '))).toHaveLength(SERVICE_TYPES.length);
  });
  /* eslint-enable no-console */
});

describe('run', () => {
  it('prints help and does nothing else', async () => {
    expect.hasAssertions();

    const { out, log } = lines();
    const commands = recorder();

    await run({ argv: ['--help'], log, execute: commands.execute });

    expect(commands.calls).toStrictEqual([]);
    expect(out.join('\n')).toContain('Jumentix Bootstrap CLI');
  });

  it('refuses non-interactive mode without a service type', async () => {
    expect.hasAssertions();

    await expect(run({ argv: ['--non-interactive', '--project-name=svc'], log: () => {} }))
      .rejects.toThrow('Non-interactive mode requires --service-type and --project-name.');
  });

  it('refuses non-interactive mode without a project name', async () => {
    expect.hasAssertions();

    await expect(run({ argv: ['--non-interactive', '--service-type=rest'], log: () => {} }))
      .rejects.toThrow('Non-interactive mode requires --service-type and --project-name.');
  });

  /**
   * The whole scaffold, end to end, against a real repository: real `git
   * clone`, real working tree, real profile read back off disk. Only the
   * dependency install is declined, by the flag a user would use.
   */
  it('clones the repository and writes the profile', async () => {
    expect.hasAssertions();

    const origin = gitRepository();
    const workspace = scratch('workspace');

    await run({
      argv: [
        '--non-interactive',
        '--service-type=graphql',
        '--project-name=my-service',
        '--git-branch=main',
        '--install-deps=n',
        `--repo=${origin}`
      ],
      log: () => {},
      workingDirectory: workspace
    });

    const target = path.join(workspace, 'my-service');

    // Cloned: the template's own file is there.
    expect(fs.readFileSync(path.join(target, 'README.md'), 'utf8')).toBe('template\n');

    const profile = JSON.parse(
      fs.readFileSync(path.join(target, '.jumentix', 'service-profile.json'), 'utf8')
    );

    expect(profile).toMatchObject({
      template: 'jumentix',
      repository: origin,
      branch: 'main',
      serviceType: 'graphql',
      profile: { interface: 'graphql', staticAssets: true, functions: false }
    });
    expect(Number.isFinite(Date.parse(profile.generatedAt))).toBe(true);
  });

  it('clones the branch it was asked for', async () => {
    expect.hasAssertions();

    const origin = gitRepository('release-9');
    const workspace = scratch('workspace');

    await run({
      argv: [
        '--non-interactive',
        '--service-type=rest',
        '--project-name=svc',
        '--git-branch=release-9',
        '--install-deps=n',
        `--repo=${origin}`
      ],
      log: () => {},
      workingDirectory: workspace
    });

    expect(JSON.parse(
      fs.readFileSync(path.join(workspace, 'svc', '.jumentix', 'service-profile.json'), 'utf8')
    ).branch).toBe('release-9');
  });

  it('installs dependencies when asked to', async () => {
    expect.hasAssertions();

    const workspace = scratch('workspace');
    const commands = recorder();

    await run({
      argv: [
        '--non-interactive', '--service-type=rest', '--project-name=svc', '--install-deps=y'
      ],
      log: () => {},
      execute: commands.execute,
      workingDirectory: workspace
    });

    expect(commands.calls.map((call) => call.command)).toStrictEqual(['git', 'bun']);
    expect(commands.calls[1].args).toStrictEqual(['install']);
    // In the new project, not in the folder the CLI was launched from.
    expect(commands.calls[1].cwd).toBe(path.join(workspace, 'svc'));
  });

  it('defaults to the canonical repository and the dev branch', async () => {
    expect.hasAssertions();

    const workspace = scratch('workspace');
    const commands = recorder();

    await run({
      argv: [
        '--non-interactive', '--service-type=rest', '--project-name=svc', '--install-deps=n'
      ],
      log: () => {},
      execute: commands.execute,
      workingDirectory: workspace
    });

    expect(commands.calls[0].args).toStrictEqual([
      'clone', '--branch', 'dev', '--', BOILERPLATE_REPOSITORY, 'svc'
    ]);
  });

  it('answers every prompt when run interactively', async () => {
    expect.hasAssertions();

    const workspace = scratch('workspace');
    const commands = recorder();
    // Service type, project name, branch, install.
    const prompt = answers('2', 'from-prompts', 'develop', 'n');

    await run({
      argv: [],
      log: () => {},
      execute: commands.execute,
      workingDirectory: workspace,
      createPrompt: prompt.createPrompt
    });

    expect(commands.calls[0].args).toStrictEqual([
      'clone', '--branch', 'develop', '--', BOILERPLATE_REPOSITORY,
      'from-prompts'
    ]);
    expect(JSON.parse(
      fs.readFileSync(path.join(workspace, 'from-prompts', '.jumentix', 'service-profile.json'), 'utf8')
    ).serviceType).toBe(SERVICE_TYPES[1].id);
  });

  it('falls back to dev and to installing with Bun when the prompts are left blank', async () => {
    expect.hasAssertions();

    const workspace = scratch('workspace');
    const commands = recorder();
    const prompt = answers('1', 'defaulted', '', '');

    await run({
      argv: [],
      log: () => {},
      execute: commands.execute,
      workingDirectory: workspace,
      createPrompt: prompt.createPrompt
    });

    expect(commands.calls[0].args[2]).toBe('dev');
    expect(commands.calls.map((call) => call.command)).toStrictEqual(['git', 'bun']);
  });

  it('requires a project name', async () => {
    expect.hasAssertions();

    const prompt = answers('1', '');

    await expect(run({
      argv: [],
      log: () => {},
      execute: () => {},
      createPrompt: prompt.createPrompt
    })).rejects.toThrow('Project folder name is required.');
  });

  /**
   * The prompt owns stdin. Left open after a failure the process hangs, which
   * reads to the user as the scaffold still working.
   */
  it('closes the prompt even when the scaffold fails', async () => {
    expect.hasAssertions();

    const prompt = answers('1', '');

    await expect(run({
      argv: [],
      log: () => {},
      execute: () => {},
      createPrompt: prompt.createPrompt
    })).rejects.toThrow('Project folder name is required.');

    expect(prompt.closeCount()).toBe(1);
  });

  it('closes the prompt when the scaffold succeeds', async () => {
    expect.hasAssertions();

    const prompt = answers('1', 'svc', 'main', 'n');

    await run({
      argv: [],
      log: () => {},
      execute: () => {},
      workingDirectory: scratch('workspace'),
      createPrompt: prompt.createPrompt
    });

    expect(prompt.closeCount()).toBe(1);
  });

  it('stops before writing a profile when the clone fails', async () => {
    expect.hasAssertions();

    const workspace = scratch('workspace');

    await expect(run({
      argv: [
        '--non-interactive', '--service-type=rest', '--project-name=svc',
        '--install-deps=n', '--repo=/nonexistent/repository.git'
      ],
      log: () => {},
      workingDirectory: workspace
    })).rejects.toThrow(/failed with exit code/);

    expect(fs.existsSync(path.join(workspace, 'svc', '.jumentix'))).toBe(false);
  });
});

describe('repository policy', () => {
  /**
   * Kept from the suite this replaces. The default clone source is a governance
   * fact, not an implementation detail: change it and every service scaffolded
   * from this template comes from somewhere else.
   */
  it('clones only from the canonical web2solutions application repository by default', () => {
    expect.hasAssertions();

    expect(BOILERPLATE_REPOSITORY).toBe('https://github.com/web2solutions/Jumentix.git');
    expect(BOILERPLATE_REPOSITORY).not.toContain('XpertMinds/Jumentix');
  });
});

describe('bootstrap defaults (JUM-681)', () => {
  it('builds a prompt over the process streams when given none', () => {
    expect.hasAssertions();
    const input = new PassThrough();
    const output = new PassThrough();
    const previousStdin = Object.getOwnPropertyDescriptor(process, 'stdin');
    const previousStdout = Object.getOwnPropertyDescriptor(process, 'stdout');

    Object.defineProperty(process, 'stdin', { configurable: true, value: input });
    Object.defineProperty(process, 'stdout', { configurable: true, value: output });

    // Production passes nothing and gets stdin/stdout. Closing immediately keeps
    // Jest's open-handle detector happy while still exercising the default path
    // in this process, where Istanbul can measure it.
    try {
      const prompt = createPrompt();

      expect(typeof prompt.ask).toBe('function');
      prompt.close();
    } finally {
      input.destroy();
      output.destroy();
      restoreProcessProperty('stdin', previousStdin);
      restoreProcessProperty('stdout', previousStdout);
    }
  });

  it('reads argv and logs through the console when neither is passed', async () => {
    expect.hasAssertions();

    // `run()` as the `bin` entry calls it: no argv, no logger. The ambient argv
    // is temporarily reduced to the executable and script names so this lands on
    // the interactive path and stops at the first prompt.
    const logged: unknown[] = [];
    const log = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logged.push(args.join(' '));
    });
    const previousArgv = process.argv;

    try {
      process.argv = ['node', 'jumentix-init'];
      await expect(bootstrap.run({
        createPrompt: () => ({ ask: async () => '', close: () => undefined }),
        execute: () => undefined,
        workingDirectory: os.tmpdir()
      })).rejects.toThrow('Invalid service type selection.');
    } finally {
      process.argv = previousArgv;
      log.mockRestore();
    }

    // It got as far as the banner before refusing, which is what proves the
    // defaulted logger was the one writing.
    expect(logged.join('\n')).toContain('Jumentix Bootstrap CLI');
  });
});
