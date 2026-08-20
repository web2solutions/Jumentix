#!/usr/bin/env bun
/* eslint-disable no-console */

const path = require('path');
const { isEntryPoint } = require('./lib/entry-point');

// Resolve the workspace package
const packageRoot = path.resolve(__dirname, '../packages/agent-registry');

function resolveRegistryEntrypoint(root = packageRoot) {
  const manifestPath = path.join(root, 'package.json');
  const manifest = require(manifestPath);
  return path.join(root, manifest.main || 'dist/index.js');
}

/**
 * Exports every command here needs. A build older than the source loads without
 * throwing and is simply missing the newer ones, which is how the mandatory
 * agent bus (Requirement 129) came to fail with
 * `registry.createRtdbClient is not a function` while `dist/index.js` sat on
 * disk looking perfectly built.
 */
const REQUIRED_REGISTRY_EXPORTS = Object.freeze([
  'createFirestoreClient',
  'createRtdbClient',
  'publishProgress'
]);

function missingExports(registry) {
  return REQUIRED_REGISTRY_EXPORTS.filter((name) => typeof registry?.[name] !== 'function');
}

function buildRegistryPackage() {
  const { execFileSync } = require('child_process');
  console.log('[agent-registry-cli] building package...');
  execFileSync('bun', ['--filter', '@jumentix/agent-registry', 'build'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
}

async function loadRegistry() {
  let registry;
  try {
    registry = require(resolveRegistryEntrypoint());
  } catch {
    // Package not built yet.
    buildRegistryPackage();
    registry = require(resolveRegistryEntrypoint());
    const stillMissing = missingExports(registry);
    if (stillMissing.length > 0) {
      throw new Error(
        `@jumentix/agent-registry build is missing: ${stillMissing.join(', ')}`
      );
    }
    return registry;
  }

  // The case the original fallback did not cover: a stale build. It requires
  // cleanly and is only detectable by asking whether it carries what the
  // caller needs.
  const stale = missingExports(registry);
  if (stale.length === 0) return registry;

  console.log(`[agent-registry-cli] stale build (missing ${stale.join(', ')}); rebuilding...`);
  delete require.cache[require.resolve(resolveRegistryEntrypoint())];
  buildRegistryPackage();
  registry = require(resolveRegistryEntrypoint());

  const stillMissing = missingExports(registry);
  if (stillMissing.length > 0) {
    // Fail closed and name the exports. Continuing here reproduces the original
    // defect one layer deeper, with a worse message.
    throw new Error(
      `@jumentix/agent-registry build is missing after rebuild: ${stillMissing.join(', ')}`
    );
  }
  return registry;
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
Jumentix Agent Registry + Bus CLI (Firestore + Firebase RTDB)

Usage: bun ci-cd/agent-registry-cli.js <command> [flags]

Commands:
  register   Register or update the current agent
  heartbeat  Update agent heartbeat and status (mirrors RTDB presence)
  assign     Assign agent to a Linear task and epic (mirrors RTDB presence)
  complete   Mark current task as complete (mirrors RTDB presence)
  publish    Publish a progress event on the RTDB agent bus
  watch      Stream RTDB progress events for an epic (JSONL)
  status     Snapshot RTDB presence + recent events for an epic
  repair     Repair records corrupted by the markdown migration (JUM-613)
  sync       Write local snapshot to .agents/registry-snapshot.json
  check      Validate local snapshot against Firestore
  help       Show this message

Flags for repair:
  --apply           Write the changes. Without it, repair only reports.

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

Flags for publish:
  --agent-id        Agent identifier (required)
  --epic            Epic id or URL (required)
  --task            Task id or URL (required)
  --kind            started|progress|blocked|handoff|completed|conflict (required)
  --summary         Short progress summary (required)
  --refs            Comma-separated PR/branch refs (optional)

Flags for watch:
  --epic            Epic id or URL (required)
  --since           ISO timestamp; only emit later events (optional)

Flags for status:
  --epic            Epic id or URL (required)
  --limit           Recent event limit (optional, default 50)

Environment:
  FIREBASE_SERVICE_ACCOUNT_KEY       Service account JSON (inline)
  FIREBASE_SERVICE_ACCOUNT_KEY_FILE  Path to existing adminsdk JSON (alternative)
  FIREBASE_DATABASE_URL              RTDB URL (optional; defaults to
                                     https://<project_id>-default-rtdb.firebaseio.com)

Reuse the existing Firebase project (jumentix-service-registry) — same key as Firestore.

Examples:
  export FIREBASE_SERVICE_ACCOUNT_KEY_FILE=/path/to/jumentix-service-registry-firebase-adminsdk-....json
  bun ci-cd/agent-registry-cli.js heartbeat --agent-id kimi-code-primary-001 --status busy
  bun ci-cd/agent-registry-cli.js publish --agent-id kimi-code-primary-001 --epic https://linear.app/... --task JUM-615 --kind progress --summary "fallback wired"
  bun ci-cd/agent-registry-cli.js watch --epic https://linear.app/...
  bun ci-cd/agent-registry-cli.js status --epic https://linear.app/...
`);
}

function isFirestoreUnavailable(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('Cloud Firestore API')
    && message.includes('disabled')
  )
    || (
      message.includes('The database (default) does not exist')
      && message.includes('Firestore database')
    )
    || message.includes('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON')
    || message.includes('FIREBASE_SERVICE_ACCOUNT_KEY_FILE is not valid JSON')
    || message.includes('Missing Firebase credentials')
    || message.includes('Invalid service account structure');
}

function shouldSkipCiRegistryCheck(command, error) {
  return command === 'check' && process.env.CI && isFirestoreUnavailable(error);
}

function logSkippedCiRegistryCheck() {
  console.log(
    '[agent-registry-cli] skipping CI registry snapshot check: '
      + 'Firestore is unavailable for the configured project or credentials.'
  );
}

const RTDB_COMMANDS = new Set([
  'heartbeat',
  'assign',
  'complete',
  'publish',
  'watch',
  'status'
]);

function hasFirebaseCredentials() {
  return Boolean(
    (process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      && String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY).trim())
    || (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE
      && String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE).trim())
  );
}

async function main() {
  const { command, flags } = parseArgs();
  if (command === 'help') {
    printHelp();
    return;
  }

  if (!hasFirebaseCredentials()) {
    if (command === 'check') {
      // Optional check: skip when Firestore credentials are not configured yet.
      console.log(
        '[agent-registry-cli] skipping check: Firebase credentials are not set '
          + '(FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_KEY_FILE).'
      );
      process.exit(0);
    }
    console.error(
      'Missing Firebase credentials: set FIREBASE_SERVICE_ACCOUNT_KEY '
        + 'or FIREBASE_SERVICE_ACCOUNT_KEY_FILE'
    );
    process.exit(1);
  }

  const registry = await loadRegistry();
  let firestore;
  let rtdb;

  try {
    // Prefer RTDB-aware init first when the bus is required so the Admin app
    // receives databaseURL before any Firestore-only initialize.
    if (RTDB_COMMANDS.has(command)) {
      rtdb = registry.createRtdbClient();
    }
    firestore = registry.createFirestoreClient();

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
        }, { rtdb });
        break;

      case 'assign':
        await registry.assignTask(firestore, {
          agent_id: flags['agent-id'],
          assigned_task: flags.task,
          active_epic: flags.epic
        }, { rtdb });
        break;

      case 'complete':
        await registry.completeTask(firestore, {
          agent_id: flags['agent-id'],
          status: flags.status
        }, { rtdb });
        break;

      case 'publish': {
        const published = await registry.publishProgress(rtdb, {
          agentId: flags['agent-id'],
          epicId: flags.epic,
          taskId: flags.task,
          kind: flags.kind,
          summary: flags.summary,
          refs: flags.refs
            ? String(flags.refs).split(',').map((value) => value.trim()).filter(Boolean)
            : undefined
        });
        console.log(JSON.stringify(published));
        break;
      }

      case 'watch': {
        const unsubscribe = registry.watchBus(rtdb, {
          epicId: flags.epic,
          since: flags.since,
          onEvent: (event, pushId) => {
            process.stdout.write(`${JSON.stringify({ pushId, ...event })}\n`);
          }
        });
        const shutdown = () => {
          unsubscribe();
          process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        // Keep the process alive until interrupted.
        await new Promise(() => {});
        break;
      }

      case 'status': {
        const limit = flags.limit ? Number(flags.limit) : undefined;
        const result = await registry.busStatus(rtdb, flags.epic, { recentLimit: limit });
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'repair': {
        // Dry run unless --apply is passed: this deletes documents belonging
        // to other agents (JUM-613).
        const result = await registry.repairRegistry(firestore, { apply: flags.apply === true });
        if (result.applied) await registry.syncSnapshot(firestore);
        break;
      }

      case 'sync':
        await registry.syncSnapshot(firestore);
        break;

      case 'check':
        try {
          await registry.checkSnapshot(firestore);
        } catch (error) {
          if (
            process.env.CI
            && String(error?.message || '').includes('Local agent registry snapshot not found')
          ) {
            try {
              await registry.syncSnapshot(firestore);
              await registry.checkSnapshot(firestore);
              break;
            } catch (syncError) {
              if (isFirestoreUnavailable(syncError)) {
                logSkippedCiRegistryCheck();
                break;
              }
              throw syncError;
            }
          }
          throw error;
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    if (shouldSkipCiRegistryCheck(command, error)) {
      logSkippedCiRegistryCheck();
      return;
    }
    throw error;
  } finally {
    await registry.closeFirestore();
  }
}

if (isEntryPoint(module)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  isFirestoreUnavailable,
  resolveRegistryEntrypoint,
  shouldSkipCiRegistryCheck,
  RTDB_COMMANDS
};
