/**
 * Shared Linear access for CI scripts (JUM-627).
 *
 * Extracted from `quarantine-flake.js`, which had the only copy. A second
 * caller was about to duplicate it, and two copies of a credential reader is
 * how one of them ends up reading the key from somewhere the other does not.
 *
 * The key is never logged, never echoed and never written anywhere: it is read
 * and passed straight to the request.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * `LINEAR_API_KEY` first, then the untracked `../.linear` file used locally.
 *
 * Returns `null` when neither exists. Callers decide what absence means —
 * `quarantine-flake.js` only needs a key for `--create-issue`, while
 * `check-pr-governance.js` treats it as required, because a membership check
 * that skips itself when unconfigured reports success without doing its work.
 */
function readLinearKey(root = process.cwd()) {
  if (process.env.LINEAR_API_KEY) return process.env.LINEAR_API_KEY.trim();
  const candidates = [
    path.resolve(root, '../.linear'),
    path.resolve(root, '../../.linear')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, 'utf8').trim();
  }
  return null;
}

function linearRequest(apiKey, query, variables) {
  const body = JSON.stringify({ query, variables });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) reject(new Error(JSON.stringify(parsed.errors)));
          else resolve(parsed.data);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * The project an issue belongs to, or `null` when it belongs to none.
 *
 * `null` is a real answer here, not a failure: an issue with no project is
 * exactly the state JUM-627 exists to catch.
 */
async function fetchIssueProject(apiKey, identifier) {
  let data;
  try {
    data = await linearRequest(
      apiKey,
      'query($id: String!) { issue(id: $id) { identifier project { id url name } } }',
      { id: identifier }
    );
  } catch (error) {
    // Linear answers an unknown identifier with a GraphQL error, not a null
    // issue, so `found: false` is only reachable through here. Raw error JSON in
    // a governance gate tells the reader nothing they can act on; every other
    // failure keeps its message, because a lookup that broke for some other
    // reason must not be reported as "this issue does not exist".
    if (/Entity not found: Issue/i.test(String(error?.message || ''))) {
      return { found: false, project: null };
    }
    throw error;
  }
  if (!data?.issue) return { found: false, project: null };
  return { found: true, project: data.issue.project ?? null };
}

module.exports = { fetchIssueProject, linearRequest, readLinearKey };
