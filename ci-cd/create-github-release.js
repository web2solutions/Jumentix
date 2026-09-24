/* eslint-disable no-console */
/**
 * Create a GitHub Release from an application tag (JUM-885).
 * Notes come from the matching CHANGELOG.md section — one source of truth.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { gitBinary } = require('./lib/git-binary.js');
const { ghBinary } = require('./lib/gh-binary.js');
const { isEntryPoint } = require('./lib/entry-point.js');
const { APP_TAG_RE } = require('./lib/next-version.js');

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

function getRepoRoot() {
  return runGit(['rev-parse', '--show-toplevel']);
}

function extractChangelogSection(changelogText, tagName) {
  const lines = String(changelogText || '').split('\n');
  const headerPrefix = `## ${tagName}`;
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith(headerPrefix)) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    return {
      title: tagName,
      body: `Release ${tagName}.\n\n(No matching CHANGELOG.md section was found.)\n`
    };
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }

  const sectionLines = lines.slice(start, end);
  const body = `${sectionLines.slice(1).join('\n').trim()}\n`;
  return { title: tagName, body: body || `Release ${tagName}.\n` };
}

function releaseExists(tagName, env = process.env) {
  const result = spawnSync(ghBinary(), ['release', 'view', tagName], {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return result.status === 0;
}

function createGithubRelease(options = {}) {
  const dryRun = Boolean(options.dryRun);
  const rootDir = options.rootDir || getRepoRoot();
  const tagName = options.tagName
    || process.env.CIRCLE_TAG
    || options.argvTag
    || '';

  if (!APP_TAG_RE.test(tagName)) {
    throw new Error(
      `Refusing to create a GitHub Release for non-application tag "${tagName}". `
      + 'Expected format vX.Y.Z.'
    );
  }

  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  const changelogText = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '';
  const { title, body } = extractChangelogSection(changelogText, tagName);
  const version = tagName.slice(1);
  const [major] = version.split('.');
  const prerelease = Number(major) === 0;

  if (!dryRun && releaseExists(tagName, options.env)) {
    return {
      action: 'noop',
      reason: 'release-already-exists',
      tag: tagName
    };
  }

  if (dryRun) {
    return {
      action: 'create',
      tag: tagName,
      title,
      prerelease,
      bodyPreview: body.slice(0, 500),
      dryRun: true
    };
  }

  const token = (options.env || process.env).GH_TOKEN
    || (options.env || process.env).GITHUB_TOKEN
    || (options.env || process.env).CHANGELOG_GH_TOKEN
    || '';
  if (!token) {
    throw new Error(
      'Missing GH_TOKEN, GITHUB_TOKEN, or CHANGELOG_GH_TOKEN. '
      + 'CI must provide a token that can create GitHub Releases (fail closed).'
    );
  }

  const notesPath = path.join(rootDir, `.github-release-notes-${tagName}.md`);
  fs.writeFileSync(notesPath, body);
  try {
    const args = [
      'release', 'create', tagName,
      '--title', title,
      '--notes-file', notesPath
    ];
    if (prerelease) args.push('--prerelease');
    execFileSync(ghBinary(), args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(options.env || {}),
        GH_TOKEN: token,
        GITHUB_TOKEN: token
      }
    });
  } finally {
    fs.rmSync(notesPath, { force: true });
  }

  return {
    action: 'created',
    tag: tagName,
    title,
    prerelease
  };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const tagArg = argv.find((arg) => APP_TAG_RE.test(arg)) || '';
  const result = createGithubRelease({
    dryRun,
    argvTag: tagArg,
    tagName: tagArg || undefined
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  createGithubRelease,
  extractChangelogSection,
  releaseExists,
  main
};

if (isEntryPoint(module)) {
  main();
}
