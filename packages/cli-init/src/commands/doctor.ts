/* eslint-disable no-console */

export function printDoctorHelp(log: (message?: string) => void = console.log): void {
  log(`
jumentix doctor

Diagnose the environment and a generated project's contract files (Req 037 v2 / JUM-852).
`);
}

export async function runDoctor(options: {
  help: boolean;
  log?: (message?: string) => void;
}): Promise<number> {
  const { help, log = console.log } = options;
  if (help) {
    printDoctorHelp(log);
    return 0;
  }
  log('doctor: not implemented yet (JUM-852).');
  return 1;
}
