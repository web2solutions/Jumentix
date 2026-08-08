#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Flake quarantine helper (JUM-499).
 * Adds a quarantine entry to test-map.json and optionally creates a Linear issue.
 *
 * Usage:
 *   bun ci-cd/quarantine-flake.js --path <suite> --reason "<text>" [--issue JUM-123]
 *   LINEAR_API_KEY / ../.linear used when --issue omitted and --create-issue is set.
 */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');
// JUM-627: one copy of the credential reader and the transport, shared with
// check-pr-governance.js.
const { linearRequest, readLinearKey } = require('./lib/linear.js');

function parseArgs(argv) {
  const out = { createIssue: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--path') out.path = argv[++i];
    else if (arg === '--reason') out.reason = argv[++i];
    else if (arg === '--issue') out.issue = argv[++i];
    else if (arg === '--create-issue') out.createIssue = true;
    else if (arg === '--project') out.project = argv[++i];
  }
  return out;
}

async function createLinearIssue(apiKey, { title, description, projectId }) {
  const teamData = await linearRequest(apiKey, 'query { teams(filter: { key: { eq: "JUM" } }) { nodes { id } } }');
  const teamId = teamData.teams.nodes[0]?.id;
  if (!teamId) throw new Error('JUM team not found');
  const data = await linearRequest(
    apiKey,
    `mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { identifier url } }
    }`,
    {
      input: {
        teamId,
        title,
        description,
        ...(projectId ? { projectId } : {})
      }
    }
  );
  return data.issueCreate.issue;
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const args = parseArgs(process.argv);
  if (!args.path || !args.reason) {
    console.error('Usage: bun ci-cd/quarantine-flake.js --path <suite> --reason "<text>" [--issue JUM-n|--create-issue]');
    process.exit(1);
  }

  const manifestPath = path.join(root, 'test-map.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.quarantine = Array.isArray(manifest.quarantine) ? manifest.quarantine : [];

  let issue = args.issue;
  if (!issue && args.createIssue) {
    const apiKey = readLinearKey(root);
    if (!apiKey) throw new Error('Missing Linear API key for --create-issue');
    const created = await createLinearIssue(apiKey, {
      title: `[Test] Quarantine flake: ${args.path}`,
      description: `Auto-created by ci-cd/quarantine-flake.js\n\nReason: ${args.reason}\n\nSuite: \`${args.path}\`\n\nPolicy: quarantined suites still run report-only and cannot block gates (JUM-499).`,
      projectId: args.project || '7f9e4a32-3b2c-4b0a-86e0-7430bb31076d'
    });
    issue = created.identifier;
    console.log(`[quarantine] created ${created.identifier} ${created.url}`);
  }

  if (!issue || !/^JUM-\d+$/.test(issue)) {
    throw new Error('Quarantine entry requires --issue JUM-n or --create-issue');
  }

  const existing = manifest.quarantine.find((entry) => entry.path === args.path);
  if (existing) {
    existing.reason = args.reason;
    existing.issue = issue;
    existing.mode = existing.mode || 'report-only';
  } else {
    manifest.quarantine.push({
      path: args.path,
      reason: args.reason,
      issue,
      mode: 'report-only',
      runnerOverride: 'node'
    });
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[quarantine] wrote entry for ${args.path} → ${issue}`);
}

if (isEntryPoint(module)) {
  main().catch((error) => {
    console.error('[quarantine]', error.message || error);
    process.exit(1);
  });
}

module.exports = { parseArgs };
