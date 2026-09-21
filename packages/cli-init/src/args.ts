/* eslint-disable no-continue, no-void, prefer-destructuring */
export type GlobalFlags = {
  help: boolean;
  nonInteractive: boolean;
  configPath: string;
};

export type InitFlags = GlobalFlags & {
  dir: string;
  mode: string;
  from: string;
  preset: string;
  http: string;
  realtime: string;
  db: string;
  frontend: boolean;
  offline: boolean;
  git: boolean;
  install: boolean;
  projectName: string;
  /** add service --domains=a,b */
  domains: string;
  /** add domain --service=<id> */
  service: string;
  /** add --force (overwrite when manifest drifted) */
  force: boolean;
  // legacy
  serviceType: string;
  gitBranch: string;
  repository: string;
  installDeps: boolean | undefined;
  legacyInvocation: boolean;
};

export type ParsedCli = {
  command: 'init' | 'add' | 'upgrade' | 'doctor' | 'help' | '';
  subcommand: string;
  positional: string[];
  init: InitFlags;
  dryRun: boolean;
};

function takeValue(raw: string, prefix: string): string {
  return raw.slice(prefix.length);
}

function parseBooleanToken(raw: string): boolean {
  const value = raw.toLowerCase();
  return value === 'y' || value === 'yes' || value === 'true' || value === '1';
}

/**
 * Detect legacy `jumentix-init --service-type=…` style (no subcommand).
 */
export function looksLikeLegacyInvocation(argv: string[]): boolean {
  if (argv.length === 0) return false;
  const first = argv[0];
  if (!first.startsWith('-')) return false;
  return argv.some((arg) => arg.startsWith('--service-type=') || arg === '--service-type');
}

export function parseArgv(argv: string[]): ParsedCli {
  const init: InitFlags = {
    help: false,
    nonInteractive: false,
    configPath: '',
    dir: '',
    mode: '',
    from: '',
    preset: '',
    http: '',
    realtime: '',
    db: '',
    frontend: false,
    offline: false,
    git: false,
    install: false,
    projectName: '',
    domains: '',
    service: '',
    force: false,
    serviceType: '',
    gitBranch: '',
    repository: '',
    installDeps: undefined,
    legacyInvocation: false
  };

  let dryRun = false;
  const positional: string[] = [];
  let index = 0;

  if (looksLikeLegacyInvocation(argv)) {
    init.legacyInvocation = true;
    for (const raw of argv) {
      if (raw === '--help' || raw === '-h') init.help = true;
      else if (raw === '--non-interactive') init.nonInteractive = true;
      else if (raw.startsWith('--service-type=')) init.serviceType = takeValue(raw, '--service-type=');
      else if (raw.startsWith('--project-name=')) init.projectName = takeValue(raw, '--project-name=');
      else if (raw.startsWith('--git-branch=')) init.gitBranch = takeValue(raw, '--git-branch=');
      else if (raw.startsWith('--install-deps=')) {
        init.installDeps = parseBooleanToken(takeValue(raw, '--install-deps='));
      } else if (raw.startsWith('--repo=')) init.repository = takeValue(raw, '--repo=');
    }
    return {
      command: 'init',
      subcommand: '',
      positional: [],
      init,
      dryRun
    };
  }

  let command: ParsedCli['command'] = '';
  if (argv[0] && !argv[0].startsWith('-')) {
    const token = argv[0];
    if (token === 'init' || token === 'add' || token === 'upgrade' || token === 'doctor' || token === 'help') {
      command = token;
      index = 1;
    }
  }

  for (; index < argv.length; index += 1) {
    const raw = argv[index];
    if (raw === '--help' || raw === '-h') {
      init.help = true;
      continue;
    }
    if (raw === '--non-interactive') {
      init.nonInteractive = true;
      continue;
    }
    if (raw === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (raw === '--frontend') {
      init.frontend = true;
      continue;
    }
    if (raw === '--offline') {
      init.offline = true;
      continue;
    }
    if (raw === '--git') {
      init.git = true;
      continue;
    }
    if (raw === '--install') {
      init.install = true;
      continue;
    }
    if (raw === '--force') {
      init.force = true;
      continue;
    }
    if (raw.startsWith('--domains=')) {
      init.domains = takeValue(raw, '--domains=');
      continue;
    }
    if (raw === '--domains') {
      init.domains = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (raw.startsWith('--service=')) {
      init.service = takeValue(raw, '--service=');
      continue;
    }
    if (raw === '--service') {
      init.service = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (raw.startsWith('--config=')) {
      init.configPath = takeValue(raw, '--config=');
      continue;
    }
    if (raw === '--config') {
      init.configPath = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (raw.startsWith('--mode=')) {
      init.mode = takeValue(raw, '--mode=');
      continue;
    }
    if (raw.startsWith('--from=')) {
      init.from = takeValue(raw, '--from=');
      continue;
    }
    if (raw.startsWith('--preset=')) {
      init.preset = takeValue(raw, '--preset=');
      continue;
    }
    if (raw.startsWith('--http=')) {
      init.http = takeValue(raw, '--http=');
      continue;
    }
    if (raw.startsWith('--realtime=')) {
      init.realtime = takeValue(raw, '--realtime=');
      continue;
    }
    if (raw.startsWith('--db=')) {
      init.db = takeValue(raw, '--db=');
      continue;
    }
    if (raw.startsWith('--project-name=')) {
      init.projectName = takeValue(raw, '--project-name=');
      continue;
    }
    if (raw.startsWith('--service-type=')) {
      init.serviceType = takeValue(raw, '--service-type=');
      init.legacyInvocation = true;
      continue;
    }
    if (raw.startsWith('--git-branch=')) {
      init.gitBranch = takeValue(raw, '--git-branch=');
      continue;
    }
    if (raw.startsWith('--install-deps=')) {
      init.installDeps = parseBooleanToken(takeValue(raw, '--install-deps='));
      continue;
    }
    if (raw.startsWith('--repo=')) {
      init.repository = takeValue(raw, '--repo=');
      continue;
    }
    if (!raw.startsWith('-')) {
      positional.push(raw);
    }
  }

  if (command === 'init' && positional[0]) {
    init.dir = positional[0];
  }

  const subcommand = command === 'add' ? (positional[0] || '') : '';

  return {
    command,
    subcommand,
    positional,
    init,
    dryRun
  };
}

export function mapLegacyServiceTypeToMode(serviceType: string): {
  mode: 'monolith';
  http: 'express';
} {
  void serviceType;
  return { mode: 'monolith', http: 'express' };
}
