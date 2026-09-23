/* eslint-disable no-console */
/**
 * Deterministic appLockedVersion bump from Conventional Commits / PR [Nature]
 * prefixes since the last application tag (JUM-883 / Requirement 060).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { gitBinary } = require('./git-binary.js');
const { isEntryPoint } = require('./entry-point.js');

const APP_TAG_RE = /^v\d+\.\d+\.\d+$/;
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const GENERATED_CHANGELOG_COMMIT = /^chore:\s+synchronize changelog(?:\s|$)/i;
const RELEASE_COMMIT = /^chore\(release\):\s+v\d+\.\d+\.\d+/i;

const MAJOR_NATURES = new Set(['breaking']);
const MINOR_NATURES = new Set(['feature', 'feat']);
const PATCH_NATURES = new Set([
  'fix', 'bug', 'bugfix', 'security', 'perf', 'refactor', 'improvement'
]);
const IGNORE_NATURES = new Set([
  'docs', 'doc', 'chore', 'test', 'tests', 'ci', 'style', 'release', 'build', 'revert'
]);

function runGit(args, options = {}) {
  try {
    return execFileSync(gitBinary(), args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe'],
      cwd: options.cwd
    }).trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function readReleasePolicy(rootDir) {
  const policyPath = path.join(rootDir, 'release-policy.json');
  return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
}

function parseSemver(version) {
  const match = SEMVER_RE.exec(String(version || ''));
  if (!match) {
    throw new Error(`Invalid semver base version: ${String(version || '')}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpSemver(baseVersion, level) {
  const parsed = parseSemver(baseVersion);
  if (level === 'major') {
    return formatSemver({ major: parsed.major + 1, minor: 0, patch: 0 });
  }
  if (level === 'minor') {
    return formatSemver({ major: parsed.major, minor: parsed.minor + 1, patch: 0 });
  }
  if (level === 'patch') {
    return formatSemver({
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch + 1
    });
  }
  throw new Error(`Unknown bump level: ${level}`);
}

function extractNature(subject) {
  const text = String(subject || '');
  const bracket = text.match(/\[([A-Za-z]+)\]/g) || [];
  for (const token of bracket) {
    const inner = token.slice(1, -1);
    if (/^JUM-\d+$/i.test(inner)) continue;
    return inner.toLowerCase();
  }
  const conventional = text.match(/^([A-Za-z]+)(!)?(?:\([^)]*\))?:/);
  if (conventional) {
    return conventional[1].toLowerCase();
  }
  return '';
}

function hasBreakingMarker(subject) {
  const text = String(subject || '');
  if (/BREAKING CHANGE/i.test(text)) return true;
  if (/\[[Bb]reaking\]/.test(text)) return true;
  if (/^[A-Za-z]+!(?:\([^)]*\))?:/.test(text)) return true;
  if (/^[A-Za-z]+(?:\([^)]*\))?!:/.test(text)) return true;
  return false;
}

function classifySubject(subject) {
  if (GENERATED_CHANGELOG_COMMIT.test(subject) || RELEASE_COMMIT.test(subject)) {
    return 'ignore';
  }
  if (hasBreakingMarker(subject)) return 'major';
  const nature = extractNature(subject);
  if (MAJOR_NATURES.has(nature)) return 'major';
  if (MINOR_NATURES.has(nature)) return 'minor';
  if (PATCH_NATURES.has(nature)) return 'patch';
  if (IGNORE_NATURES.has(nature)) return 'ignore';
  if (!nature) return 'ignore';
  return 'patch';
}

function rankLevel(level) {
  if (level === 'major') return 3;
  if (level === 'minor') return 2;
  if (level === 'patch') return 1;
  return 0;
}

function getApplicationTags(cwd) {
  const output = runGit([
    'for-each-ref',
    '--sort=-creatordate',
    '--format=%(refname:short)',
    'refs/tags'
  ], { allowFailure: true, cwd });

  if (!output) return [];
  return output.split('\n').map((line) => line.trim()).filter((name) => APP_TAG_RE.test(name));
}

function getCommitSubjectsSince(tagName, cwd) {
  const range = tagName ? `${tagName}..HEAD` : 'HEAD';
  const output = runGit([
    'log',
    '--pretty=format:%s',
    range
  ], { allowFailure: true, cwd });
  if (!output) return [];
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function computeNextVersion({
  baseVersion,
  subjects,
  lastAppTag = null
} = {}) {
  const commits = (subjects || []).map((subject) => ({
    subject,
    level: classifySubject(subject)
  }));

  if (commits.length === 0) {
    return {
      action: 'noop',
      reason: 'no-commits',
      baseVersion,
      nextVersion: baseVersion,
      lastAppTag,
      bumpLevel: null,
      commits
    };
  }

  let highest = null;
  for (const commit of commits) {
    if (rankLevel(commit.level) > rankLevel(highest)) {
      highest = commit.level;
    }
  }

  if (!highest || highest === 'ignore') {
    return {
      action: 'noop',
      reason: 'no-releasable-commits',
      baseVersion,
      nextVersion: baseVersion,
      lastAppTag,
      bumpLevel: null,
      commits
    };
  }

  const nextVersion = bumpSemver(baseVersion, highest);
  return {
    action: 'bump',
    reason: `bump:${highest}`,
    baseVersion,
    nextVersion,
    lastAppTag,
    bumpLevel: highest,
    commits
  };
}

function resolveNextVersionFromRepo(options = {}) {
  const rootDir = options.rootDir
    || runGit(['rev-parse', '--show-toplevel'], { cwd: options.cwd });
  const policy = options.policy || readReleasePolicy(rootDir);
  const baseVersion = options.baseVersion || policy.appLockedVersion;
  const tags = options.tags || getApplicationTags(rootDir);
  const lastAppTag = tags.length > 0 ? tags[0] : null;
  const subjects = options.subjects || getCommitSubjectsSince(lastAppTag, rootDir);
  return computeNextVersion({
    baseVersion,
    subjects,
    lastAppTag
  });
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const result = resolveNextVersionFromRepo();
  const payload = {
    ...result,
    dryRun
  };
  console.log(JSON.stringify(payload, null, 2));
  if (result.action === 'noop') {
    process.exitCode = 0;
    return payload;
  }
  return payload;
}

module.exports = {
  APP_TAG_RE,
  bumpSemver,
  classifySubject,
  computeNextVersion,
  extractNature,
  getApplicationTags,
  getCommitSubjectsSince,
  hasBreakingMarker,
  parseSemver,
  resolveNextVersionFromRepo,
  main
};

if (isEntryPoint(module)) {
  main();
}
