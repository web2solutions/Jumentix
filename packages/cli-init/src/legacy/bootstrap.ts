/* eslint-disable no-console, no-continue */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';

export const BOILERPLATE_REPOSITORY = 'https://github.com/web2solutions/Jumentix.git';

export const SERVICE_TYPES = [
  {
    id: 'rest',
    label: 'HTTP/REST server (OpenAPI/Swagger + static assets)',
    profile: { interface: 'http-rest', staticAssets: true, functions: false }
  },
  {
    id: 'websocket',
    label: 'WebSocket server (+ static assets)',
    profile: { interface: 'websocket', staticAssets: true, functions: false }
  },
  {
    id: 'grpc',
    label: 'gRPC server (+ static assets)',
    profile: { interface: 'grpc', staticAssets: true, functions: false }
  },
  {
    id: 'graphql',
    label: 'GraphQL server (+ static assets)',
    profile: { interface: 'graphql', staticAssets: true, functions: false }
  },
  {
    id: 'functions',
    label: 'Function services bundle (AWS/Google/Azure/Vercel/Cloudflare)',
    profile: { interface: 'functions', staticAssets: false, functions: true }
  }
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export function printHelp(log: (message?: string) => void = console.log): void {
  log(`
Jumentix Bootstrap CLI (legacy)

Usage:
  jumentix-init [options]

Options:
  --help                         Show this message and exit
  --non-interactive              Disable prompts (requires --service-type and --project-name)
  --service-type=<id>            One of: rest, websocket, grpc, graphql, functions
  --project-name=<name>          Target folder name/path
  --git-branch=<branch>          Branch to clone (default: dev)
  --install-deps=<y|n|true|false> Install dependencies after scaffold (default: true)
  --repo=<git-url>               Override template repository URL
`);
}

export type LegacyCliArgs = {
  help: boolean;
  nonInteractive: boolean;
  serviceTypeId: string;
  projectName: string;
  gitBranch: string;
  installDeps: boolean | undefined;
  repository: string;
};

export function parseCliArgs(argv: string[]): LegacyCliArgs {
  const args: LegacyCliArgs = {
    help: false,
    nonInteractive: false,
    serviceTypeId: '',
    projectName: '',
    gitBranch: '',
    installDeps: undefined,
    repository: ''
  };

  for (const rawArg of argv) {
    if (rawArg === '--help' || rawArg === '-h') {
      args.help = true;
      continue;
    }
    if (rawArg === '--non-interactive') {
      args.nonInteractive = true;
      continue;
    }
    if (rawArg.startsWith('--service-type=')) {
      args.serviceTypeId = rawArg.split('=')[1] || '';
      continue;
    }
    if (rawArg.startsWith('--project-name=')) {
      args.projectName = rawArg.split('=')[1] || '';
      continue;
    }
    if (rawArg.startsWith('--git-branch=')) {
      args.gitBranch = rawArg.split('=')[1] || '';
      continue;
    }
    if (rawArg.startsWith('--install-deps=')) {
      const installDepsRaw = (rawArg.split('=')[1] || '').toLowerCase();
      args.installDeps = installDepsRaw === 'y'
        || installDepsRaw === 'yes'
        || installDepsRaw === 'true'
        || installDepsRaw === '1';
      continue;
    }
    if (rawArg.startsWith('--repo=')) {
      args.repository = rawArg.split('=')[1] || '';
    }
  }

  return args;
}

export function createPrompt({
  input = process.stdin,
  output = process.stdout
}: {
  input?: Readable;
  output?: Writable;
} = {}): { ask: (question: string) => Promise<string>; close: () => void } {
  const rl = readline.createInterface({
    input: input as any,
    output: output as any
  });
  const ask = (question: string): Promise<string> => new Promise((resolve) => {
    rl.question(question, (answer) => resolve(String(answer || '').trim()));
  });
  return {
    ask,
    close: () => rl.close()
  };
}

export const GIT_LOCATION_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE'
];

export function environmentWithoutRepositoryLocation(
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const copy = { ...env };
  for (const name of GIT_LOCATION_VARIABLES) delete copy[name];
  return copy;
}

export function runCommand(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: environmentWithoutRepositoryLocation()
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${String(result.status)}`);
  }
}

export function toAbsolute(targetPath: string, base = process.cwd()): string {
  if (path.isAbsolute(targetPath)) return targetPath;
  return path.resolve(base, targetPath);
}

export function ensureTargetFolderIsEmpty(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;
  const files = fs.readdirSync(targetPath);
  if (files.length > 0) {
    throw new Error(`Target folder "${targetPath}" already exists and is not empty.`);
  }
}

export async function chooseServiceType(
  ask: (question: string) => Promise<string>,
  log: (message?: string) => void = console.log
): Promise<ServiceType> {
  log('\nSelect service type:');
  SERVICE_TYPES.forEach((type, index) => {
    log(` ${index + 1}. ${type.label}`);
  });
  const selected = await ask('Type number: ');
  const index = Number(selected) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= SERVICE_TYPES.length) {
    throw new Error('Invalid service type selection.');
  }
  return SERVICE_TYPES[index];
}

export function resolveServiceTypeById(serviceTypeId: string): ServiceType {
  const found = SERVICE_TYPES.find((serviceType) => serviceType.id === serviceTypeId);
  if (!found) {
    throw new Error(`Invalid service type "${serviceTypeId}".`);
  }
  return found;
}

export function writeBootstrapProfile(
  targetPath: string,
  payload: Record<string, unknown>
): void {
  const configDir = path.join(targetPath, '.jumentix');
  fs.mkdirSync(configDir, { recursive: true });
  const outputPath = path.join(configDir, 'service-profile.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function run(options: {
  argv?: string[];
  log?: (message?: string) => void;
  createPrompt?: typeof createPrompt;
  execute?: typeof runCommand;
  workingDirectory?: string;
} = {}): Promise<void> {
  const {
    argv = process.argv.slice(2),
    log = console.log,
    createPrompt: makePrompt = createPrompt,
    execute = runCommand,
    workingDirectory = process.cwd()
  } = options;

  const cliArgs = parseCliArgs(argv);
  if (cliArgs.help) {
    printHelp(log);
    return;
  }

  if (cliArgs.nonInteractive && (!cliArgs.serviceTypeId || !cliArgs.projectName)) {
    throw new Error('Non-interactive mode requires --service-type and --project-name.');
  }

  const prompt = cliArgs.nonInteractive
    ? { ask: async () => '', close: () => undefined }
    : makePrompt();

  try {
    log('\nJumentix Bootstrap CLI');
    const serviceType = cliArgs.serviceTypeId
      ? resolveServiceTypeById(cliArgs.serviceTypeId)
      : await chooseServiceType(prompt.ask, log);

    const projectName = cliArgs.projectName || await prompt.ask('Project folder name (e.g. my-service): ');
    if (!projectName) throw new Error('Project folder name is required.');
    const targetPath = toAbsolute(projectName, workingDirectory);
    ensureTargetFolderIsEmpty(targetPath);

    const gitBranch = cliArgs.gitBranch
      || (await prompt.ask('Git branch to clone (default: dev): '))
      || 'dev';
    const installDeps = typeof cliArgs.installDeps === 'boolean'
      ? cliArgs.installDeps
      : (((await prompt.ask('Run bun install after scaffold? (Y/n): ')) || 'y').toLowerCase() !== 'n');
    const repository = cliArgs.repository || BOILERPLATE_REPOSITORY;

    log('\nCloning boilerplate repository...');
    execute('git', ['clone', '--branch', gitBranch, '--', repository, projectName], workingDirectory);

    writeBootstrapProfile(targetPath, {
      generatedAt: new Date().toISOString(),
      template: 'jumentix',
      repository,
      branch: gitBranch,
      serviceType: serviceType.id,
      profile: serviceType.profile
    });

    if (installDeps) {
      log('\nInstalling dependencies...');
      execute('bun', ['install'], targetPath);
    }

    log('\nScaffold completed successfully.');
    log(`Project path: ${targetPath}`);
    log(`Profile: ${path.join(targetPath, '.jumentix', 'service-profile.json')}`);
  } finally {
    prompt.close();
  }
}
