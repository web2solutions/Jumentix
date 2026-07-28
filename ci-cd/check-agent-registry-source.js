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

<<<<<<< HEAD
function buildRawUrl(config, ref = config.revision || config.branch) {
  const { owner, repo } = repositoryCoordinates(config);
  const remotePath = config.remotePath.replace(/^\/+/, '');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${remotePath}?ref=${encodeURIComponent(ref)}`;
=======
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
>>>>>>> origin/dev
}

function buildBranchRevisionUrl(config) {
  const { owner, repo } = repositoryCoordinates(config);
  return `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(config.branch)}`;
}

<<<<<<< HEAD
function fetchBody(url, accept) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        Accept: accept,
        'User-Agent': 'jumentix-agent-registry-check'
      }
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Failed to fetch registry source: HTTP ${res.statusCode} (${url})`));
=======
function fetchBody(url, headers, sourceName) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        if (typeof res.resume === 'function') res.resume();
        reject(new Error(`Failed to fetch ${sourceName}: HTTP ${res.statusCode || 'unknown'} (${url})`));
>>>>>>> origin/dev
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
<<<<<<< HEAD
  return fetchBody(url, 'application/vnd.github.raw+json');
}

async function fetchJson(url) {
  const body = await fetchBody(url, 'application/vnd.github+json');
=======
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

async function fetchJson(url) {
  const body = await fetchBody(
    url,
    githubApiHeaders(),
    'canonical registry branch revision'
  );
>>>>>>> origin/dev
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

  const url = buildRawUrl(config, revision);

  if (args.printUrl) {
    console.log(url);
    return;
  }

  const remoteContent = await fetchText(url);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Local mirrored registry file not found: ${localPath}`);
  }
  const localContent = fs.readFileSync(localPath, 'utf8');
  const same = mirrorsMatch(localContent, remoteContent);

  if (args.check) {
    if (!same) {
      console.error('Local agent registry mirror is out of sync with canonical repository.');
      console.error(`Source: ${url}`);
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
  buildRawUrl,
<<<<<<< HEAD
=======
  encodeRawPath,
>>>>>>> origin/dev
  fetchJson,
  fetchText,
  githubApiHeaders,
  mirrorsMatch,
  normalize,
  parseArgs,
  readConfig,
  resolveBranchRevision
};
