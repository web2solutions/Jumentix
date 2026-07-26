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

function buildRawUrl(config, ref = config.revision || config.branch) {
  const { owner, repo } = repositoryCoordinates(config);
  const remotePath = config.remotePath.replace(/^\/+/, '');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${remotePath}?ref=${encodeURIComponent(ref)}`;
}

function buildBranchRevisionUrl(config) {
  const { owner, repo } = repositoryCoordinates(config);
  return `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(config.branch)}`;
}

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
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function fetchText(url) {
  return fetchBody(url, 'application/vnd.github.raw+json');
}

async function fetchJson(url) {
  const body = await fetchBody(url, 'application/vnd.github+json');
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
  const same = normalize(localContent) === normalize(remoteContent);

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
  fetchJson,
  fetchText,
  normalize,
  parseArgs,
  readConfig,
  resolveBranchRevision
};
