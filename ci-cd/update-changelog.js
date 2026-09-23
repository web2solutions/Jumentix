/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHANGELOG_FILE = 'CHANGELOG.md';
const RECORD_SEPARATOR = '\x1e';
const FIELD_SEPARATOR = '\x1f';
const GIT_BIN_CANDIDATES = ['/usr/bin/git', '/usr/local/bin/git'];
const GIT_BIN = GIT_BIN_CANDIDATES.find((candidate) => fs.existsSync(candidate));
const GENERATED_CHANGELOG_COMMIT = /^chore:\s+synchronize changelog(?:\s|$)/i;

function runGit(args, options = {}) {
  if (!GIT_BIN) {
    throw new Error('Git binary not found in fixed system locations.');
  }
  try {
    return execFileSync(GIT_BIN, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', options.allowFailure ? 'ignore' : 'pipe']
    }).trim();
  } catch (error) {
    if (options.allowFailure) return '';
    throw error;
  }
}

function getRepoRoot() {
  return runGit(['rev-parse', '--show-toplevel']);
}

function getTags() {
  const output = runGit([
    'for-each-ref',
    '--sort=-creatordate',
    '--format=%(refname:short)%09%(creatordate:short)',
    'refs/tags'
  ], { allowFailure: true });

  if (!output) return [];

  // Application tags only (`vX.Y.Z`). Package tags (`@jumentix/pkg@version`)
  // must not create changelog sections (JUM-882 / Requirement 060).
  const APP_TAG_RE = /^v\d+\.\d+\.\d+$/;

  return output.split('\n').map((line) => {
    const [name, date] = line.split('\t');
    const commit = runGit(['rev-list', '-n', '1', name]);
    return {
      name,
      date,
      commit
    };
  }).filter((tag) => APP_TAG_RE.test(tag.name));
}

function getCommitDate(ref) {
  const isoDate = runGit(['show', '-s', '--format=%aI', ref], { allowFailure: true });
  if (!isoDate) return '';
  const [date] = isoDate.split('T');
  return date || '';
}

function getCommits(range) {
  const output = runGit([
    'log',
    `--pretty=format:%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`,
    range
  ], { allowFailure: true });

  if (!output) return [];

  return output
    .split(RECORD_SEPARATOR)
    .filter(Boolean)
    .map((record) => {
      const [hash, shortHash, isoDate, author, subject] = record.split(FIELD_SEPARATOR);
      const [date] = (isoDate || '').split('T');
      return {
        hash,
        shortHash,
        date,
        author,
        subject
      };
    })
    // The synchronization PR itself is an implementation detail. Ignoring it
    // makes the main-only job idempotent after that PR is merged.
    .filter((commit) => !GENERATED_CHANGELOG_COMMIT.test(commit.subject));
}

function formatCommit(commit) {
  return `- ${commit.date} ${commit.subject} - ${commit.author}`;
}

function formatSection(title, commits) {
  const lines = [`## ${title}`, ''];

  if (commits.length === 0) {
    lines.push('- No changes.');
  } else {
    lines.push(...commits.map(formatCommit));
  }

  lines.push('');
  return lines.join('\n');
}

function generateChangelog() {
  const tags = getTags();
  const lines = [
    '# Changelog',
    '',
    '<!-- This file is generated from Git history. GitHub Actions synchronizes it after merges to main. -->',
    ''
  ];

  if (tags.length === 0) {
    lines.push(formatSection('All Changes', getCommits('HEAD')));
    return `${lines.join('\n').trim()}\n`;
  }

  const [latestTag] = tags;
  const unreleasedCommits = getCommits(`${latestTag.name}..HEAD`);
  lines.push(formatSection('Unreleased', unreleasedCommits));

  tags.forEach((tag, index) => {
    const nextTag = tags[index + 1];
    const range = nextTag ? `${nextTag.name}..${tag.name}` : tag.name;
    const tagDate = tag.date || getCommitDate(tag.name);
    lines.push(formatSection(`${tag.name} - ${tagDate}`, getCommits(range)));
  });

  return `${lines.join('\n').trim()}\n`;
}

function getHeadCommitLine() {
  const output = runGit([
    'show',
    '-s',
    `--format=%aI${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%s`,
    'HEAD'
  ], { allowFailure: true });

  if (!output) return '';

  const [isoDate, author, subject] = output.split(FIELD_SEPARATOR);
  const [date] = (isoDate || '').split('T');
  if (!date || !author || !subject) return '';
  return `- ${date} ${subject} - ${author}`;
}

function removeLineOnce(text, line) {
  if (!line) return text;
  const token = `${line}\n`;
  if (text.includes(token)) return text.replace(token, '');
  return text.replace(line, '');
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const root = getRepoRoot();
  const changelogPath = path.join(root, CHANGELOG_FILE);
  const generated = generateChangelog();
  const current = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '';

  if (checkOnly) {
    const generatedPreviousHead = removeLineOnce(generated, getHeadCommitLine());
    const isSynced = current === generated || current === generatedPreviousHead;
    if (!isSynced) {
      console.error(`${CHANGELOG_FILE} is out of sync with Git history.`);
      console.error(`Run "bun run changelog:update" and commit the generated changes.`);
      process.exit(1);
    }
    console.log(`${CHANGELOG_FILE} is in sync with Git history.`);
    return;
  }

  fs.writeFileSync(changelogPath, generated);
  console.log(`${CHANGELOG_FILE} updated from Git history.`);
}

main();
