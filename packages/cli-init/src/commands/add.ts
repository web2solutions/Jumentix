/* eslint-disable no-console */

export function printAddHelp(log: (message?: string) => void = console.log): void {
  log(`
jumentix add <domain|service|frontend> [name] [options]

Extend a generated Jumentix project (Req 037 v2 / JUM-850).

Subcommands:
  add domain <name> [--from …]
  add service <name> --domains a,b
  add frontend
`);
}

export async function runAdd(options: {
  subcommand: string;
  positional: string[];
  help: boolean;
  log?: (message?: string) => void;
}): Promise<number> {
  const { subcommand, help, log = console.log } = options;
  if (help || !subcommand) {
    printAddHelp(log);
    return help ? 0 : 1;
  }
  log(`add ${subcommand}: not implemented yet (JUM-850).`);
  return 1;
}
