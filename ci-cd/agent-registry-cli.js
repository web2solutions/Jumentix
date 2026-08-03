#!/usr/bin/env bun
/* eslint-disable no-console */

const { createRequire } = require('module');
const path = require('path');

// Resolve the workspace package
const require = createRequire(import.meta.url || __filename);
const packageRoot = path.resolve(__dirname, '../packages/agent-registry');

async function loadRegistry() {
  try {
    return require(packageRoot);
  } catch (error) {
    // Package not built yet — try to build on the fly for local dev
    const { execFileSync } = require('child_process');
    console.log('[agent-registry-cli] building package...');
    execFileSync('bun', ['--filter', '@jumentix/agent-registry', 'build'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
    return require(packageRoot);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const flags = {};
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    }
  }
  return { command, flags };
}

function printHelp() {
  console.log(`
Jumentix Agent Registry CLI (Firestore)

Usage: bun ci-cd/agent-registry-cli.js <command> [flags]

Commands:
  register   Register or update the current agent
  heartbeat  Update agent heartbeat and status
  assign     Assign agent to a Linear task and epic
  complete   Mark current task as complete
  sync       Write local snapshot to .agents/registry-snapshot.json
  check      Validate local snapshot against Firestore
  help       Show this message

Flags for register:
  --agent-id        Agent identifier (required)
  --agent-name      Human-readable name (required)
  --platform        Agent platform (required)
  --machine-id      Machine identifier (required)
  --machine-name    Machine name (required)
  --machine-os      Machine OS/arch (required)
  --workspace-path  Workspace path (required)
  --agent-runtime   Agent runtime (required)
  --agent-version   Agent version (required)
  --capabilities    Comma-separated capabilities (optional)

Flags for heartbeat:
  --agent-id        Agent identifier (required)
  --status          available|busy|blocked|offline (optional)
  --main-ref        Main branch ref checked (optional)
  --dev-ref         Dev branch ref checked (optional)

Flags for assign:
  --agent-id        Agent identifier (required)
  --task            Linear task URL (required)
  --epic            Linear epic URL (required)

Flags for complete:
  --agent-id        Agent identifier (required)
  --status          available|busy|blocked|offline (optional)

Environment:
  FIREBASE_SERVICE_ACCOUNT_KEY  Service account JSON (required)

Examples:
  bun ci-cd/agent-registry-cli.js register --agent-id kimi-code-primary-001 ...
  bun ci-cd/agent-registry-cli.js heartbeat --agent-id kimi-code-primary-001 --status busy
  bun ci-cd/agent-registry-cli.js assign --agent-id kimi-code-primary-001 --task https://... --epic https://...
  bun ci-cd/agent-registry-cli.js complete --agent-id kimi-code-primary-001 --status available
  bun ci-cd/agent-registry-cli.js sync
  bun ci-cd/agent-registry-cli.js check
`);
}

async function main() {
  const { command, flags } = parseArgs();
  if (command === 'help') {
    printHelp();
    return;
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.error('Missing required environment variable: FIREBASE_SERVICE_ACCOUNT_KEY');
    process.exit(1);
  }

  const registry = await loadRegistry();
  const firestore = registry.createFirestoreClient();

  try {
    switch (command) {
      case 'register':
        await registry.registerAgent(firestore, {
          agent_id: flags['agent-id'],
          agent_name: flags['agent-name'],
          platform: flags.platform,
          machine_id: flags['machine-id'],
          machine_name: flags['machine-name'],
          machine_os: flags['machine-os'],
          workspace_path: flags['workspace-path'],
          agent_runtime: flags['agent-runtime'],
          agent_version: flags['agent-version'],
          capabilities: flags.capabilities ? String(flags.capabilities).split(',').map((s) => s.trim()).filter(Boolean) : undefined
        });
        break;

      case 'heartbeat':
        await registry.heartbeat(firestore, {
          agent_id: flags['agent-id'],
          status: flags.status,
          main_ref_checked: flags['main-ref'],
          dev_ref_checked: flags['dev-ref']
        });
        break;

      case 'assign':
        await registry.assignTask(firestore, {
          agent_id: flags['agent-id'],
          assigned_task: flags.task,
          active_epic: flags.epic
        });
        break;

      case 'complete':
        await registry.completeTask(firestore, {
          agent_id: flags['agent-id'],
          status: flags.status
        });
        break;

      case 'sync':
        await registry.syncSnapshot(firestore);
        break;

      case 'check':
        await registry.checkSnapshot(firestore);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } finally {
    await registry.closeFirestore();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
