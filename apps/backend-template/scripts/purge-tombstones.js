#!/usr/bin/env bun
/**
 * JUM-822 — opt-in tombstone purge. Default is dry-run (stdout JSONL, no write).
 * dev PM2 calls this with --via-loopback so the dev RestAPI process owns the store.
 */

const parseArgs = (argv) => {
  const flags = {
    commit: false,
    protectSeed: true,
    viaLoopback: false,
    olderThan: 90,
    port: Number(process.env.JUMENTIX_HTTP_PORT || 3000)
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--commit') flags.commit = true;
    else if (arg === '--dry-run') flags.commit = false;
    else if (arg === '--no-protect-seed') flags.protectSeed = false;
    else if (arg === '--protect-seed') flags.protectSeed = true;
    else if (arg === '--via-loopback') flags.viaLoopback = true;
    else if (arg === '--older-than') {
      flags.olderThan = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--port') {
      flags.port = Number(argv[i + 1]);
      i += 1;
    }
  }
  if (!Number.isFinite(flags.olderThan) || flags.olderThan < 1) {
    throw new Error('--older-than must be a positive number of days');
  }
  return flags;
};

const printReport = (report) => {
  for (const event of report.events || []) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
  process.stdout.write(`${JSON.stringify({
    summary: true,
    dryRun: report.dryRun,
    olderThanDays: report.olderThanDays,
    eligible: (report.events || []).length,
    skippedProtected: report.skippedProtected,
    skippedTooYoung: report.skippedTooYoung
  })}\n`);
};

const viaLoopback = async (flags) => {
  const url = `http://127.0.0.1:${flags.port}/internal/tombstones/purge`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      commit: flags.commit,
      olderThanDays: flags.olderThan,
      protectSeed: flags.protectSeed
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Purge loopback ${response.status}: ${text}`);
  }
  return response.json();
};

const main = async () => {
  const flags = parseArgs(process.argv.slice(2));
  if (!flags.viaLoopback) {
    throw new Error(
      'In-process dev stores live in the RestAPI process. Use --via-loopback against dev RestAPI.'
    );
  }
  const report = await viaLoopback(flags);
  printReport(report);
};

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      process.stderr.write(`purge-tombstones: RestAPI not reachable (${message})\n`);
      process.exit(0);
    }
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}

export { parseArgs, printReport };
