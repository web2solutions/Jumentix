#!/usr/bin/env bun
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('../../../ci-cd/lib/entry-point.js');

const packageRoot = path.resolve(__dirname, '../packages/agent-registry');

/**
 * Strips the markdown that formats a value from the value itself (JUM-613).
 *
 * The original parser stripped the backticks around the *key* and kept the
 * ones around the *value*, so every record it wrote carried them into
 * Firestore — including the field used as the document id. Ten of twelve
 * documents were corrupt, and a `status` typed as a four-value union held
 * `` `busy` ``.
 */
function unformat(value) {
  return String(value).trim().replace(/^`+|`+$/g, '').trim();
}

function parseMarkdownRegistry(content) {
  const agents = [];
  const lines = content.split('\n');
  let currentAgent = null;

  for (const line of lines) {
    const agentHeader = line.match(/^### \d+\) (.+)$/);
    if (agentHeader) {
      if (currentAgent) agents.push(currentAgent);
      currentAgent = { agent_id: unformat(agentHeader[1]), capabilities: [] };
      continue;
    }

    if (!currentAgent) continue;

    const fieldMatch = line.match(/^- `([^`]+)`:\s*(.+)$/);
    if (fieldMatch) {
      const [, key, value] = fieldMatch;
      const trimmedValue = unformat(value);
      switch (key) {
        case 'agent_id':
        case 'agent_name':
        case 'platform':
        case 'machine_id':
        case 'machine_name':
        case 'machine_os':
        case 'workspace_path':
        case 'agent_runtime':
        case 'agent_version':
        case 'status':
        case 'registered_at_utc':
        case 'last_branch_check_utc':
        case 'main_ref_checked':
        case 'dev_ref_checked':
        case 'active_epic':
        case 'assigned_task':
          currentAgent[key] = trimmedValue;
          break;
        case 'capabilities':
          currentAgent.capabilities = trimmedValue
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          break;
        default:
          break;
      }
      continue;
    }

    const capMatch = line.match(/^\s{2}- (.+)$/);
    if (capMatch && currentAgent.capabilities) {
      currentAgent.capabilities.push(unformat(capMatch[1]));
    }
  }

  if (currentAgent) agents.push(currentAgent);
  return agents;
}

async function main() {
  const registryPath = path.resolve('.agents/AGENT-REGISTRY.md');
  if (!fs.existsSync(registryPath)) {
    console.error(`Agent registry not found: ${registryPath}`);
    process.exit(1);
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error('Missing required environment variable: FIREBASE_SERVICE_ACCOUNT_KEY');
    process.exit(1);
  }

  const content = fs.readFileSync(registryPath, 'utf8');
  const agents = parseMarkdownRegistry(content);
  console.log(`[migrate] parsed ${agents.length} agents from markdown registry`);

  const registry = require(packageRoot);
  const firestore = registry.createFirestoreClient();

  const results = { upserted: [], skipped: [], errors: [] };

  for (const agent of agents) {
    try {
      if (!agent.agent_id) {
        results.skipped.push(agent.agent_id || '(no id)');
        continue;
      }

      const record = {
        agent_id: agent.agent_id,
        agent_name: agent.agent_name || agent.agent_id,
        platform: agent.platform || 'unknown',
        machine_id: agent.machine_id || 'unknown',
        machine_name: agent.machine_name || 'unknown',
        machine_os: agent.machine_os || 'unknown',
        workspace_path: agent.workspace_path || 'unknown',
        agent_runtime: agent.agent_runtime || 'unknown',
        agent_version: agent.agent_version || 'unknown',
        status: agent.status || 'available',
        registered_at_utc: agent.registered_at_utc || new Date().toISOString(),
        last_heartbeat_utc: agent.last_branch_check_utc || new Date().toISOString(),
        last_branch_check_utc: agent.last_branch_check_utc || new Date().toISOString(),
        main_ref_checked: agent.main_ref_checked || '',
        dev_ref_checked: agent.dev_ref_checked || '',
        active_epic: agent.active_epic || 'none',
        assigned_task: agent.assigned_task || 'none',
        capabilities: agent.capabilities || []
      };

      await registry.upsertAgent(firestore, record);
      results.upserted.push(agent.agent_id);
    } catch (error) {
      results.errors.push({ agent_id: agent.agent_id, error: error.message });
    }
  }

  await registry.closeFirestore();

  console.log(`[migrate] upserted: ${results.upserted.length}`);
  console.log(`[migrate] skipped: ${results.skipped.length}`);
  console.log(`[migrate] errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    results.errors.forEach((e) => console.error(`  ${e.agent_id}: ${e.error}`));
    process.exit(1);
  }
}

// Guarded (JUM-613). Without this the module runs its migration the moment
// anything requires it, which is why the parser that corrupted ten documents
// had no test: it could not be imported without also being executed.
if (isEntryPoint(module)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { parseMarkdownRegistry, unformat };
