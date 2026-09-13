/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const BOILERPLATE_REPOSITORY = 'https://github.com/web2solutions/Jumentix.git';
const SERVICE_TYPES = [
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
];

function printHelp(log = console.log) {
  log(`
Jumentix Bootstrap CLI

Usage:
  jumentix-init [options]

Options:
  --help                         Show this message and exit
  --non-interactive              Disable prompts (requires --service-type and --project-name)
  --service-type=<id>            One of: rest, websocket, grpc, graphql, functions
  --project-name=<name>          Target folder name/path
  --git-branch=<branch>          Branch to clone (default: main)
  --install-deps=<y|n|true|false> Install dependencies after scaffold (default: true)
  --repo=<git-url>               Override template repository URL
`);
}

function parseCliArgs(argv) {
  const args = {
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
      args.installDeps = installDepsRaw === 'y' || installDepsRaw === 'yes' || installDepsRaw === 'true' || installDepsRaw === '1';
      continue;
    }

    if (rawArg.startsWith('--repo=')) {
      args.repository = rawArg.split('=')[1] || '';
    }
  }

  return args;
}

/**
 * The streams are parameters so a suite can drive a real `readline` interface
 * over a pair of pipes instead of standing in for one. Production passes
 * nothing and gets stdin/stdout, exactly as before.
 */
function createPrompt({ input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, output });

  const ask = (question) => new Promise((resolve) => {
    rl.question(question, (answer) => resolve(String(answer || '').trim()));
  });

  return {
    ask,
    close: () => rl.close()
  };
}

/**
 * The variables that tell git which repository it is already operating on.
 *
 * This CLI clones into a new, empty folder, so it must not inherit them. Run
 * `jumentix-init` from inside a git hook — or from any shell with GIT_DIR
 * exported — and an inherited location makes the clone fail, or succeed
 * against the wrong repository: git reinitialises whatever GIT_DIR points at.
 *
 * Credentials and transport settings (GIT_SSH_COMMAND, GIT_ASKPASS,
 * GIT_TERMINAL_PROMPT and the rest) are deliberately left in place. Those are
 * how a user reaches a private template, and dropping them would break the
 * clone rather than protect it.
 */
const GIT_LOCATION_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE'
];

function environmentWithoutRepositoryLocation(env = process.env) {
  const copy = { ...env };
  for (const name of GIT_LOCATION_VARIABLES) delete copy[name];
  return copy;
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: environmentWithoutRepositoryLocation()
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${String(result.status)}`);
  }
}

function toAbsolute(targetPath, base = process.cwd()) {
  if (path.isAbsolute(targetPath)) return targetPath;
  return path.resolve(base, targetPath);
}

function ensureTargetFolderIsEmpty(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const files = fs.readdirSync(targetPath);
  if (files.length > 0) {
    throw new Error(`Target folder "${targetPath}" already exists and is not empty.`);
  }
}

async function chooseServiceType(ask, log = console.log) {
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

function resolveServiceTypeById(serviceTypeId) {
  const found = SERVICE_TYPES.find((serviceType) => serviceType.id === serviceTypeId);
  if (!found) {
    throw new Error(`Invalid service type "${serviceTypeId}".`);
  }
  return found;
}

function writeBootstrapProfile(targetPath, payload) {
  const configDir = path.join(targetPath, '.jumentix');
  fs.mkdirSync(configDir, { recursive: true });
  const outputPath = path.join(configDir, 'service-profile.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/**
 * Every outside edge this function touches — the argument vector, the console,
 * the prompt, the subprocess runner and the working directory — is a parameter
 * with its production value as the default. The `bin` entry still calls `run()`
 * and behaves exactly as it did; a suite can call it against a scratch
 * directory and a repository on disk without touching either.
 */
async function run(options = {}) {
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
    ? { ask: async () => '', close: () => {} }
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

    const gitBranch = cliArgs.gitBranch || (await prompt.ask('Git branch to clone (default: main): ')) || 'main';
    const installDeps = typeof cliArgs.installDeps === 'boolean'
      ? cliArgs.installDeps
      : (((await prompt.ask('Run bun install after scaffold? (Y/n): ')) || 'y').toLowerCase() !== 'n');
    const repository = cliArgs.repository || BOILERPLATE_REPOSITORY;

    log('\nCloning boilerplate repository...');
    execute('git', ['clone', '--branch', gitBranch, repository, targetPath], workingDirectory);

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
      execute('npm', ['install'], targetPath);
    }

    log('\nScaffold completed successfully.');
    log(`Project path: ${targetPath}`);
    log(`Profile: ${path.join(targetPath, '.jumentix', 'service-profile.json')}`);
  } finally {
    prompt.close();
  }
}

module.exports = {
  BOILERPLATE_REPOSITORY,
  GIT_LOCATION_VARIABLES,
  SERVICE_TYPES,
  chooseServiceType,
  environmentWithoutRepositoryLocation,
  createPrompt,
  ensureTargetFolderIsEmpty,
  parseCliArgs,
  printHelp,
  resolveServiceTypeById,
  run,
  runCommand,
  toAbsolute,
  writeBootstrapProfile
};
