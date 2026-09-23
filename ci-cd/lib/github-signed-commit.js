/**
 * Signed commits + annotated tags via GitHub API.
 * Matches `.github/workflows/ci.yml` sync-changelog (createCommitOnBranch).
 * Required on `main` because branch protection demands PRs and verified commits.
 */
const { execFileSync } = require('child_process');
const { ghBinary } = require('./gh-binary.js');

function resolveToken(env = process.env) {
  return env.GH_TOKEN || env.GITHUB_TOKEN || env.CHANGELOG_GH_TOKEN || '';
}

function resolveRepository(env = process.env) {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  if (env.CIRCLE_PROJECT_USERNAME && env.CIRCLE_PROJECT_REPONAME) {
    return `${env.CIRCLE_PROJECT_USERNAME}/${env.CIRCLE_PROJECT_REPONAME}`;
  }
  return '';
}

function requireToken(env = process.env) {
  const token = resolveToken(env);
  if (!token) {
    throw new Error(
      'Missing GH_TOKEN, GITHUB_TOKEN, or CHANGELOG_GH_TOKEN (fail closed).'
    );
  }
  return token;
}

function ghEnv(env = process.env) {
  const token = requireToken(env);
  return {
    ...process.env,
    ...env,
    GH_TOKEN: token,
    GITHUB_TOKEN: token
  };
}

function createSignedCommitOnBranchWithGh({
  repository,
  branch,
  expectedHeadOid,
  headline,
  additions,
  env = process.env,
  execFile = execFileSync,
  ghPath = null
}) {
  if (!repository) throw new Error('repository is required');
  if (!branch) throw new Error('branch is required');
  if (!expectedHeadOid) throw new Error('expectedHeadOid is required');
  if (!headline) throw new Error('headline is required');
  if (!Array.isArray(additions) || additions.length === 0) {
    throw new Error('additions must be a non-empty array of {path, contents}');
  }

  const binary = ghPath || ghBinary();
  const mutation = `mutation CreateSignedCommit($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit { oid }
    }
  }`;

  const payload = JSON.stringify({
    query: mutation,
    variables: {
      input: {
        branch: {
          repositoryNameWithOwner: repository,
          branchName: branch
        },
        expectedHeadOid,
        message: { headline },
        fileChanges: {
          additions: additions.map((item) => ({
            path: item.path,
            contents: Buffer.from(item.contents, 'utf8').toString('base64')
          }))
        }
      }
    }
  });

  const stdout = execFile(binary, ['api', 'graphql', '--input', '-'], {
    encoding: 'utf8',
    input: payload,
    env: ghEnv(env),
    stdio: ['pipe', 'pipe', 'pipe']
  }).toString().trim();

  const parsed = JSON.parse(stdout);
  if (parsed.errors?.length) {
    throw new Error(`createCommitOnBranch failed: ${JSON.stringify(parsed.errors)}`);
  }
  const oid = parsed.data?.createCommitOnBranch?.commit?.oid;
  if (!oid) {
    throw new Error(`createCommitOnBranch returned no oid: ${stdout.slice(0, 500)}`);
  }
  return { oid, raw: parsed };
}

function createAnnotatedTagRef({
  repository,
  tag,
  message,
  commitSha,
  env = process.env,
  execFile = execFileSync,
  ghPath = null
}) {
  const binary = ghPath || ghBinary();
  const envWithToken = ghEnv(env);

  const tagObject = JSON.parse(execFile(binary, [
    'api',
    `repos/${repository}/git/tags`,
    '-f', `tag=${tag}`,
    '-f', `message=${message}`,
    '-f', `object=${commitSha}`,
    '-f', 'type=commit'
  ], {
    encoding: 'utf8',
    env: envWithToken,
    stdio: ['ignore', 'pipe', 'pipe']
  }).toString().trim());

  if (!tagObject.sha) {
    throw new Error(`Failed to create annotated tag object for ${tag}`);
  }

  execFile(binary, [
    'api',
    `repos/${repository}/git/refs`,
    '-f', `ref=refs/tags/${tag}`,
    '-f', `sha=${tagObject.sha}`
  ], {
    encoding: 'utf8',
    env: envWithToken,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return { tag, tagObjectSha: tagObject.sha, commitSha };
}

module.exports = {
  createAnnotatedTagRef,
  createSignedCommitOnBranchWithGh,
  resolveRepository,
  resolveToken
};
