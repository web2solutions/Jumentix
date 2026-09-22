/* eslint-disable no-console */
import { parseArgv } from './args';
import { readInitConfig } from './config';
import { runAdd } from './commands/add';
import { runDoctor } from './commands/doctor';
import { runInit } from './commands/init';
import { runUpgrade } from './commands/upgrade';

export function printRootHelp(log: (message?: string) => void = console.log): void {
  log(`
Jumentix CLI (@jumentix/cli-init)

Usage:
  jumentix <command> [options]

Commands:
  init       Create a lean workspace (factory generator)
  add        Add domain | service | frontend to a generated project
  upgrade    Template three-way merge
  doctor     Environment and project diagnostics
  help       Show this message

Run \`jumentix <command> --help\` for command-specific options.

Exit codes: 0 ok, 1 user error, 2 environment failure.
`);
}

export async function main(
  argv = process.argv.slice(2),
  log: (message?: string) => void = console.log
): Promise<number> {
  const parsed = parseArgv(argv);

  if (parsed.command === 'help' || (!parsed.command && parsed.init.help)) {
    printRootHelp(log);
    return 0;
  }

  if (!parsed.command) {
    printRootHelp(log);
    return 1;
  }

  if (parsed.init.configPath) {
    const fromFile = readInitConfig(parsed.init.configPath);
    if (!parsed.init.mode && fromFile.mode) parsed.init.mode = fromFile.mode;
    if (!parsed.init.from && fromFile.from) parsed.init.from = fromFile.from;
    if (!parsed.init.preset && fromFile.preset) parsed.init.preset = fromFile.preset;
    if (!parsed.init.http && fromFile.http) parsed.init.http = fromFile.http;
    if (!parsed.init.realtime && fromFile.realtime) parsed.init.realtime = fromFile.realtime;
    if (!parsed.init.db && fromFile.db) parsed.init.db = fromFile.db;
    if (!parsed.init.projectName && fromFile.projectName) {
      parsed.init.projectName = fromFile.projectName;
    }
    if (fromFile.frontend) parsed.init.frontend = true;
    if (fromFile.offline) parsed.init.offline = true;
    if (fromFile.git) parsed.init.git = true;
    if (fromFile.install) parsed.init.install = true;
    if (fromFile.nonInteractive) parsed.init.nonInteractive = true;
  }

  try {
    if (parsed.command === 'init') {
      return await runInit({ flags: parsed.init, log });
    }
    if (parsed.command === 'add') {
      return await runAdd({
        subcommand: parsed.subcommand,
        positional: parsed.positional,
        help: parsed.init.help,
        flags: {
          from: parsed.init.from || undefined,
          domains: parsed.init.domains || undefined,
          service: parsed.init.service || undefined,
          force: parsed.init.force,
          offline: parsed.init.offline
        },
        log
      });
    }
    if (parsed.command === 'upgrade') {
      return await runUpgrade({
        help: parsed.init.help,
        dryRun: parsed.dryRun,
        force: parsed.init.force,
        log
      });
    }
    if (parsed.command === 'doctor') {
      return await runDoctor({ help: parsed.init.help, log });
    }
    printRootHelp(log);
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`\nError: ${message}`);
    return 1;
  }
}

export async function runAsCli(argv = process.argv.slice(2)): Promise<void> {
  const code = await main(argv);
  if (code !== 0) {
    process.exitCode = code;
  }
}
