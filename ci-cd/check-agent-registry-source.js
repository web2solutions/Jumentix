/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.resolve('.agents/registry-source.json');

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    check: args.has('--check') || (!args.has('--sync') && !args.has('--url')),
    sync: args.has('--sync'),
    printUrl: args.has('--url')
  };
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Missing registry source config: ${CONFIG_PATH}`);
  }
  const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const required = ['repository', 'branch', 'remotePath', 'localMirrorPath'];
  for (const key of required) {
    if (!parsed[key] || typeof parsed[key] !== 'string') {
      throw new Error(`Invalid registry source config: "${key}" is required`);
    }
  }
  if (!parsed.revision || !/^[a-f0-9]{40}$/i.test(parsed.revision)) {
    throw new Error('Invalid registry source config: "revision" must be a full commit SHA');
  }
  return parsed;
}

function repositoryCoordinates(config) {
  const [owner, repo] = config.repository.split('/');
  if (!owner || !repo) {
    throw new Error('Invalid repository format in registry source config. Expected "owner/repo".');
  }
  return { owner, repo };
}

function encodeRawPath(remotePath) {
  const segments = String(remotePath || '').replace(/^\/+/, '').split('/');
  if (segments.length === 0 || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid registry remote path.');
  }
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

function buildRawUrl(config, ref = config.revision) {
  const { owner, repo } = repositoryCoordinates(config);
  if (!/^[a-f0-9]{40}$/i.test(String(ref || ''))) {
    throw new Error('Canonical registry content requires a full immutable commit SHA.');
  }
  const remotePath = encodeRawPath(config.remotePath);
  return [
    'https://raw.githubusercontent.com',
    encodeURIComponent(owner),
    encodeURIComponent(repo),
    encodeURIComponent(ref),
    remotePath
  ].join('/');
}

function buildContentsApiUrl(config, ref = config.revision) {
  const { owner, repo } = repositoryCoordinates(config);
  if (!/^[a-f0-9]{40}$/i.test(String(ref || ''))) {
    throw new Error('Canonical registry content requires a full immutable commit SHA.');
  }
  const remotePath = encodeRawPath(config.remotePath);
  return [
    'https://api.github.com/repos',
    encodeURIComponent(owner),
    encodeURIComponent(repo),
    'contents',
    remotePath
  ].join('/') + `?ref=${encodeURIComponent(ref)}`;
}

function buildBranchRevisionUrl(config) {
  const { owner, repo } = repositoryCoordinates(config);
  return `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(config.branch)}`;
}

function fetchBody(url, headers, sourceName) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        if (typeof res.resume === 'function') res.resume();
        reject(new Error(`Failed to fetch ${sourceName}: HTTP ${res.statusCode || 'unknown'} (${url})`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve(body));
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch ${sourceName}: ${error.message}`, { cause: error }));
    });
  });
}

function fetchText(url) {
  return fetchBody(url, {
    Accept: 'text/plain',
    'User-Agent': 'jumentix-agent-registry-check'
  }, 'immutable canonical registry content');
}

function githubApiHeaders(env = process.env) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'jumentix-agent-registry-check',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function hasGithubToken(env = process.env) {
  return Boolean(env.GITHUB_TOKEN || env.GH_TOKEN);
}

async function fetchCanonicalText(config, revision, env = process.env) {
  let tokenAccessFailure = null;

  if (hasGithubToken(env)) {
    try {
      const url = buildContentsApiUrl(config, revision);
      const content = await fetchBody(
        url,
        {
          ...githubApiHeaders(env),
          Accept: 'application/vnd.github.raw'
        },
        'immutable canonical registry content'
      );
      return { content, sourceUrl: url };
    } catch (error) {
      const message = error && error.message ? String(error.message) : '';
      // Stale/mis-scoped tokens must not block public raw fetch for the canonical registry.
      if (!/HTTP (401|403|404)/.test(message)) {
        throw error;
      }
      if (/HTTP (401|403)/.test(message)) {
        tokenAccessFailure = error;
      }
    }
  }

  const sourceUrl = buildRawUrl(config, revision);
  try {
    const content = await fetchText(sourceUrl);
    return { content, sourceUrl };
  } catch (error) {
    const message = error && error.message ? String(error.message) : '';
    if (tokenAccessFailure && /HTTP 404/.test(message)) {
      // Private repos often answer anonymous raw with 404; prefer the token-access signal.
      throw new Error(
        `${tokenAccessFailure.message}. Authenticated Contents API failed and public raw fetch returned HTTP 404. ` +
          'If the canonical registry is private, fix GITHUB_TOKEN or GH_TOKEN with contents:read. ' +
          'If it is public, verify the pinned revision SHA and remotePath in .agents/registry-source.json.',
        { cause: error }
      );
    }
    if (/HTTP (401|403)/.test(message)) {
      throw new Error(
        `${message}. Private canonical registry access requires GITHUB_TOKEN or GH_TOKEN with contents:read.`,
        { cause: error }
      );
    }
    if (/HTTP 404/.test(message)) {
      throw new Error(
        `${message}. Verify the pinned revision SHA and remotePath in .agents/registry-source.json.`,
        { cause: error }
      );
    }
    throw error;
  }
}

async function fetchJson(url) {
  const body = await fetchBody(
    url,
    githubApiHeaders(),
    'canonical registry branch revision'
  );
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error(`Invalid JSON response from registry source: ${url}`, { cause: error });
  }
}

async function resolveBranchRevision(config) {
  const payload = await fetchJson(buildBranchRevisionUrl(config));
  if (!payload.sha || !/^[a-f0-9]{40}$/i.test(payload.sha)) {
    throw new Error(`Could not resolve canonical registry revision for branch "${config.branch}".`);
  }
  return payload.sha;
}

function normalize(content) {
  return content.replace(/\r\n/g, '\n').trimEnd();
}

function mirrorsMatch(localContent, remoteContent) {
  return normalize(localContent) === normalize(remoteContent);
}

async function main() {
  const args = parseArgs();
  const config = readConfig();
  const localPath = path.resolve(config.localMirrorPath);
  let revision = config.revision;

  if (args.sync) {
    revision = await resolveBranchRevision(config);
  }

  if (args.printUrl) {
    const url = hasGithubToken()
      ? buildContentsApiUrl(config, revision)
      : buildRawUrl(config, revision);
    console.log(url);
    return;
  }

  const { content: remoteContent, sourceUrl } = await fetchCanonicalText(config, revision);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Local mirrored registry file not found: ${localPath}`);
  }
  const localContent = fs.readFileSync(localPath, 'utf8');
  const same = mirrorsMatch(localContent, remoteContent);

  if (args.check) {
    if (!same) {
      console.error('Local agent registry mirror is out of sync with canonical repository.');
      console.error(`Source: ${sourceUrl}`);
      console.error(`Run: node ci-cd/check-agent-registry-source.js --sync`);
      process.exit(1);
    }
    console.log(`Agent registry mirror matches canonical revision ${revision}.`);
    return;
  }

  if (args.sync) {
    fs.writeFileSync(localPath, remoteContent);
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify({ ...config, revision }, null, 2)}\n`);
    console.log(`Agent registry mirror synchronized from canonical revision ${revision}.`);
    return;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  buildBranchRevisionUrl,
  buildContentsApiUrl,
  buildRawUrl,
  encodeRawPath,
  fetchCanonicalText,
  fetchJson,
  fetchText,
  githubApiHeaders,
  hasGithubToken,
  mirrorsMatch,
  normalize,
  parseArgs,
  readConfig,
  resolveBranchRevision
};
