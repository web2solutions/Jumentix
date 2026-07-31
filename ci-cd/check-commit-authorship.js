#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Requirement 111 — only declared identities may author or commit here.
 *
 * A commit's identity is not verified by anything. `user.email` is a string the
 * committer chooses, so any address at all can be attached to a commit and the
 * forge will render it as fact. That makes it a disclosure channel: whatever is
 * configured leaks into every commit, into the pull request UI, and into every
 * downstream tool that reads commit metadata — secret scanners name the
 * "developer involved" from it — and unlike a leaked file it cannot be deleted
 * afterwards, because rewriting shared history does not remove the old objects
 * from the forge.
 *
 * So this is checked before commits spread, not after.
 *
 * The declaration is an allowlist (`.agents/AUTHORIZED-COMMITTERS.json`) rather
 * than a list of banned addresses. The incident behind this requirement started
 * with one corporate address the owner knew about; the audit turned up a second
 * corporate domain from a former employer that nobody was looking for. A
 * denylist would have passed that one silently.
 *
 * Fails closed (Requirement 065): a missing declaration, an unparseable one, an
 * empty identity list, or a git invocation that does not succeed is a failure,
 * never a pass. The alternative is a check that reports success precisely when
 * it has lost the ability to verify anything.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const DECLARATION_PATH = '.agents/AUTHORIZED-COMMITTERS.json';

/**
 * Read git history through an argument array, never a shell.
 *
 * The range endpoints reach this from the environment, and a ref name is
 * attacker-influenced in a fork-based workflow.
 */
function defaultRunGit(args, root = process.cwd()) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 64 * 1024 * 1024
  });
}

/**
 * Parse the declaration, rejecting every shape that would weaken the check.
 *
 * An empty or absent `identities` list is the dangerous case: it parses, it
 * iterates, and it matches nothing — so every commit would be reported as
 * unauthorized, or, with the comparison inverted, none would. Rejecting it here
 * means the file cannot be defanged by emptying it.
 */
function parseDeclaration(contents) {
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${DECLARATION_PATH} is not valid JSON: ${error.message}`);
  }

  const identities = parsed?.identities;
  if (!Array.isArray(identities) || identities.length === 0) {
    throw new Error(`${DECLARATION_PATH} declares no identities.`);
  }

  const emails = new Set();
  for (const identity of identities) {
    const email = identity?.email;
    if (typeof email !== 'string' || email.trim().length === 0) {
      throw new Error(`${DECLARATION_PATH} has an identity with no email.`);
    }
    emails.add(email.trim().toLowerCase());
  }

  const cutoff = parsed?.historyCutoff?.commit;
  if (typeof cutoff !== 'string' || !/^[0-9a-f]{40}$/.test(cutoff)) {
    throw new Error(
      `${DECLARATION_PATH} has no valid historyCutoff.commit (40-character SHA).\n`
        + '  The cutoff is what stops this check from silently starting partway through\n'
        + '  history. Without it the scope is undefined.'
    );
  }

  return { emails, cutoff };
}

/**
 * The commits this check is answerable for.
 *
 * Everything after the cutoff, reachable from HEAD — not a diff against the base
 * branch. A base-relative range is empty whenever the check runs on the branch
 * it was merged into, and an empty range passes while verifying nothing: the
 * false green Requirement 065 exists to prevent. Anchoring to a fixed commit
 * means the set only grows, and the same rule holds on a feature branch, on dev
 * and on main.
 */
function commitsToVerify(cutoff, runGit, root) {
  // ASCII unit separator, written as an escape: a raw control character here is
  // invisible to anyone reading the file and survives a careless copy-paste as
  // whitespace. A printable delimiter is not an option either — a display name
  // may contain any printable character, so a crafted name could forge an extra
  // field and shift the email column.
  const separator = '\x1f';
  const output = runGit(
    ['log', `${cutoff}..HEAD`, `--format=%H${separator}%an${separator}%ae${separator}%cn${separator}%ce`],
    root
  );

  return String(output)
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [sha, authorName, authorEmail, committerName, committerEmail] = line.split(separator);
      return { sha, authorName, authorEmail, committerName, committerEmail };
    });
}

/**
 * Both roles, every commit.
 *
 * Author and committer diverge on rebases, amends, cherry-picks and web merges —
 * exactly the operations that rewrite identity — so checking one leaves the
 * other carrying whatever it likes.
 */
function unauthorizedCommits(commits, allowed) {
  const violations = [];

  for (const commit of commits) {
    const author = String(commit.authorEmail || '').trim().toLowerCase();
    const committer = String(commit.committerEmail || '').trim().toLowerCase();

    const roles = [];
    if (!allowed.has(author)) roles.push({ role: 'author', name: commit.authorName, email: commit.authorEmail });
    if (!allowed.has(committer)) roles.push({ role: 'committer', name: commit.committerName, email: commit.committerEmail });

    if (roles.length > 0) violations.push({ sha: commit.sha, roles });
  }

  return violations;
}

/**
 * Validate the identity a commit is *about* to be stamped with.
 *
 * The range check above cannot run before a commit exists: at pre-commit time
 * `cutoff..HEAD` does not contain the commit being written, so it passes and the
 * undeclared commit is created anyway — caught only on the next push, once it is
 * already in the reflog and possibly already pushed.
 *
 * This closes that window by asking git what it would use. `git var
 * GIT_AUTHOR_IDENT` is the resolved value after every layer of configuration and
 * environment override, which is the thing that will actually be written —
 * reading `user.email` alone would miss `GIT_AUTHOR_EMAIL` in the environment.
 */
function checkConfiguredIdentity(options = {}) {
  const root = options.root || process.cwd();
  const runGit = options.runGit || defaultRunGit;
  const readFile = options.readFile
    || ((relative) => fs.readFileSync(path.join(root, relative), 'utf8'));

  let declaration;
  try {
    declaration = parseDeclaration(readFile(DECLARATION_PATH));
  } catch (error) {
    return { ok: false, message: `Identity check failed (Requirement 111):\n\n- ${error.message}` };
  }

  const resolve = (variable) => {
    // "Name <email> 1700000000 +0000" — the address is the bracketed part.
    const ident = String(runGit(['var', variable], root));
    return /<([^>]*)>/.exec(ident)?.[1]?.trim().toLowerCase() ?? '';
  };

  let author;
  let committer;
  try {
    author = resolve('GIT_AUTHOR_IDENT');
    committer = resolve('GIT_COMMITTER_IDENT');
  } catch (error) {
    return {
      ok: false,
      message:
        'Identity check failed (Requirement 111):\n\n'
        + `- git could not resolve the identity for this commit: ${error.message}\n`
        + '  Requirement 111 §7 sets no global identity, so this is expected until you\n'
        + '  configure one for this repository:\n\n'
        + '    git config user.email "<a declared address>"\n'
        + '    git config user.name "<your name>"'
    };
  }

  const undeclared = [
    ...(declaration.emails.has(author) ? [] : [`author <${author}>`]),
    ...(declaration.emails.has(committer) ? [] : [`committer <${committer}>`])
  ];

  if (undeclared.length > 0) {
    return {
      ok: false,
      message:
        'Identity check failed (Requirement 111): this commit would be attributed to an '
        + `undeclared identity.\n\n  ${undeclared.join('\n  ')}\n\n`
        + `  Permitted identities are declared in ${DECLARATION_PATH}.\n`
        + '  Set one for this repository before committing:\n\n'
        + '    git config user.email "<a declared address>"\n'
        + '    git config user.name "<your name>"\n\n'
        + '  Blocked here rather than after the fact because commit metadata cannot be\n'
        + '  retracted: once pushed, the address stays reachable on the forge even if the\n'
        + '  history is later rewritten.'
    };
  }

  return { ok: true, message: `Identity check passed: committing as <${author}>.` };
}

function run(options = {}) {
  const root = options.root || process.cwd();
  const runGit = options.runGit || defaultRunGit;
  const readFile = options.readFile
    || ((relative) => fs.readFileSync(path.join(root, relative), 'utf8'));

  let declaration;
  try {
    declaration = parseDeclaration(readFile(DECLARATION_PATH));
  } catch (error) {
    return {
      ok: false,
      message: `Commit authorship check failed (Requirement 111):\n\n- ${error.message}`
    };
  }

  let commits;
  try {
    commits = commitsToVerify(declaration.cutoff, runGit, root);
  } catch (error) {
    return {
      ok: false,
      message:
        'Commit authorship check failed (Requirement 111):\n\n'
        + `- Could not read history from the cutoff commit: ${error.message}\n`
        + '  This check cannot verify anything without git, and reporting success in that\n'
        + '  state would be a false green. If the cutoff commit is missing, fetch it:\n'
        + '    git fetch origin --no-tags'
    };
  }

  const violations = unauthorizedCommits(commits, declaration.emails);

  if (violations.length > 0) {
    const lines = violations.map((violation) => {
      const roles = violation.roles
        .map((entry) => `      ${entry.role}: ${entry.name} <${entry.email}>`)
        .join('\n');
      return `  ${violation.sha.slice(0, 12)}\n${roles}`;
    });

    return {
      ok: false,
      message:
        `Commit authorship check failed (Requirement 111): `
        + `${violations.length} commit(s) with an undeclared identity.\n\n`
        + `${lines.join('\n')}\n\n`
        + `  Every identity permitted here is declared in ${DECLARATION_PATH}.\n`
        + '  If this is your own commit, your git identity is wrong for this repository:\n\n'
        + '    git config user.email "<a declared address>"\n'
        + '    git config user.name "<your name>"\n\n'
        + '  and rewrite the commits already made — while they are still only on your\n'
        + '  branch. Once they reach a shared branch the address cannot be taken back:\n'
        + '  the forge keeps the old objects reachable by SHA even after a rewrite.\n\n'
        + '    git rebase --exec "git commit --amend --no-edit --reset-author" <base>\n\n'
        + '  If the identity is legitimate and simply not declared yet, add it to\n'
        + `  ${DECLARATION_PATH} in the same change, so the addition is reviewed.`
    };
  }

  return {
    ok: true,
    message:
      `Commit authorship check passed: ${commits.length} commit(s) since the declared `
      + 'cutoff, all by declared identities.'
  };
}

/**
 * Select a mode, report, and return the exit code.
 *
 * Separated from the entry-point guard so the dispatch is reachable from a test.
 * Left inline it was six statements no suite could execute, which is how the
 * wrong mode gets wired to a flag and nothing notices.
 *
 * `--identity` validates what the next commit would be stamped with; the default
 * validates the commits that already exist. Both are needed: the first cannot see
 * a commit that has not been made, the second cannot prevent one.
 */
function main(argv = process.argv, io = console, options = {}) {
  const result = argv.includes('--identity')
    ? (options.checkConfiguredIdentity || checkConfiguredIdentity)()
    : (options.run || run)();

  if (result.ok) {
    io.log(result.message);
    return 0;
  }

  io.error(result.message);
  return 1;
}

/**
 * Run only when this file *is* the process entry point.
 *
 * A function rather than a bare `if (isEntryPoint(module))` block so the guard is
 * reachable from a test. The inline form is unreachable by construction — under a
 * test runner this file is always imported, never the entry point — which leaves
 * the one line that decides whether the check runs at all as the only line no
 * suite can execute. The module-scope call below runs on import, so both halves
 * are covered.
 */
function runAsEntryPoint(options = {}) {
  const {
    caller = module,
    entry = require.main,
    exit = (code) => { process.exitCode = code; },
    runMain = main
  } = options;

  if (!isEntryPoint(caller, entry)) return false;
  exit(runMain());
  return true;
}

runAsEntryPoint();

module.exports = {
  DECLARATION_PATH,
  checkConfiguredIdentity,
  commitsToVerify,
  main,
  parseDeclaration,
  runAsEntryPoint,
  run,
  unauthorizedCommits
};
