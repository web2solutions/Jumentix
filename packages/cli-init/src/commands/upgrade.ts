/* eslint-disable no-console */

export function printUpgradeHelp(log: (message?: string) => void = console.log): void {
  log(`
jumentix upgrade [--dry-run]

Apply a template three-way merge using .jumentix/manifest.json (Req 037 v2 / JUM-851).
`);
}

export async function runUpgrade(options: {
  help: boolean;
  dryRun: boolean;
  log?: (message?: string) => void;
}): Promise<number> {
  const { help, dryRun, log = console.log } = options;
  if (help) {
    printUpgradeHelp(log);
    return 0;
  }
  log(`upgrade${dryRun ? ' --dry-run' : ''}: not implemented yet (JUM-851).`);
  return 1;
}
