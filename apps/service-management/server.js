const fs = require('fs');
const path = require('path');
const http = require('http');
const { collectHostMetrics } = require('./src/runtime/hostMetrics');
const { attachAsyncContextMetrics } = require('./src/runtime/asyncContextScrape');
const { attachProcessDiskIo } = require('./src/runtime/processDiskIo');
const { createPm2WsHub } = require('./src/runtime/pm2WsHub');
const { createPm2ActionRunner } = require('./src/runtime/pm2Lifecycle');
const { withPm2DaemonLock } = require('./src/runtime/pm2DaemonLock');

const rootDirectory = __dirname;
const projectRoot = path.resolve(__dirname, '..');
const configDirectory = process.env.JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR
  ? path.resolve(process.env.JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR)
  : path.join(projectRoot, 'backend-template', 'src', 'config');
const host = process.env.JUMENTIX_SERVICE_MANAGEMENT_HOST || '127.0.0.1';
const port = Number(process.env.JUMENTIX_SERVICE_MANAGEMENT_PORT || 3200);
const authToken = process.env.JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN || '';
// Write allowlist (editable tier): runtime topology selectors only — frameworks,
// drivers, adapters, protocol toggles. Adding a key here is a security decision;
// the per-key reasons live in requirement
// .agents/requirements/software/126-service-management-ownership-and-public-contracts.md
const editableRuntimeKeys = [
  'JUMENTIX_HTTP_FRAMEWORK',
  'JUMENTIX_REALTIME_API',
  'JUMENTIX_REALTIME_API_PROTOCOL',
  'JUMENTIX_REALTIME_API_DATABASE_DRIVER',
  'JUMENTIX_DATABASE_DRIVER',
  'JUMENTIX_KEYVALUESTORAGE_DRIVER',
  'JUMENTIX_MESSAGE_MEDIATOR_ADAPTER',
  'JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER',
  'JUMENTIX_WEBSOCKET_REDIS_URL'
];
// Read-only tier: connection endpoints and non-secret configuration. Visible in
// GET so the designer reflects reality; never writable through POST.
const readOnlyRuntimeKeys = [
  'JUMENTIX_DATABASE_NAME',
  'JUMENTIX_ENABLE_BASIC_AUTH',
  'JUMENTIX_JWT_ISSUER',
  'JUMENTIX_JWT_AUDIENCE',
  'JUMENTIX_REDIS_HOST',
  'JUMENTIX_REDIS_PORT',
  'JUMENTIX_REDIS_DATABASE',
  'JUMENTIX_RABBITMQ_EXCHANGE',
  'JUMENTIX_RABBITMQ_REQUEST_QUEUE',
  'JUMENTIX_RABBITMQ_PREFETCH',
  'JUMENTIX_CORS_ALLOWED_ORIGINS',
  'JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS',
  'JUMENTIX_AUTH_LOGIN_WINDOW_SECONDS',
  'JUMENTIX_AUTH_LOCKOUT_SECONDS',
  'JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL'
];
// Never-exposed tier (JUMENTIX_JWT_TOKEN_SECRET_KEY, JUMENTIX_REDIS_PASSWORD,
// JUMENTIX_RABBITMQ_URL and any other credential-bearing key) is enforced by
// omission: keys outside the two allowlists above are neither read nor written.
const defaultsByRuntimeKey = {
  JUMENTIX_HTTP_FRAMEWORK: 'express',
  JUMENTIX_REALTIME_API: 'no',
  JUMENTIX_REALTIME_API_PROTOCOL: 'websocket',
  JUMENTIX_REALTIME_API_DATABASE_DRIVER: 'Mongo',
  JUMENTIX_DATABASE_DRIVER: 'InMemory',
  JUMENTIX_KEYVALUESTORAGE_DRIVER: 'redis',
  JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: 'inmemory',
  JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER: '',
  JUMENTIX_WEBSOCKET_REDIS_URL: '',
  JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL:
    process.env.JUMENTIX_SERVICE_MANAGEMENT_CATALOG_API_URL || ''
};
// Canonical enum sets per editable key, mirrored from
// documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md and the backend sources
// (RuntimeEnvironment.ts, compileDatabaseClient.ts, compileKeyValueStorageClient.ts,
// compileMessageMediator.ts, socket-io adapters).
const runtimeKeyEnums = {
  JUMENTIX_HTTP_FRAMEWORK: [
    'express',
    'fastify',
    'restify',
    'cloudflare-workers',
    'vercel-functions',
    'loopback',
    'sails-js',
    'feathers',
    'derby-js',
    'adonis-js',
    'total-js'
  ],
  JUMENTIX_REALTIME_API: ['yes', 'no'],
  JUMENTIX_REALTIME_API_PROTOCOL: ['websocket', 'grpc'],
  JUMENTIX_REALTIME_API_DATABASE_DRIVER: ['Mongo', 'PostgreSQL', 'MySQL', 'MS SQL', 'RDS', 'Aurora', 'Cassandra'],
  JUMENTIX_DATABASE_DRIVER: [
    'InMemory',
    'IndexedDB',
    'Mongo',
    'PostgreSQL',
    'MySQL',
    'MSSQL',
    'Oracle',
    'SQLite',
    'DynamoDB',
    'Cassandra',
    'Firebase',
    'Aurora',
    'RDS'
  ],
  JUMENTIX_KEYVALUESTORAGE_DRIVER: ['inmemory', 'redis'],
  JUMENTIX_MESSAGE_MEDIATOR_ADAPTER: ['inmemory', 'rabbitmq', 'bullmq']
};
// Editable keys whose enum admits the empty string as "unset, use backend default".
const optionalRuntimeKeyEnums = {
  JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER: ['cluster', 'redis-streams']
};
const envFileByRuntime = {
  dev: '.env.dev',
  development: '.env.dev',
  staging: '.env.staging',
  ci: '.env.ci',
  test: '.env.ci'
};
// PM2 ecosystem resolution (JUM-480). The designer's PM2 preview reads the real
// ecosystem files instead of a hardcoded command map, so adding an app to
// pm2/ecosystem.*.cjs changes the preview with no code change — and the Bun
// cutover (JUM-33/JUM-40) cannot silently invalidate the preview, because no
// package-manager invocation is embedded anywhere: the reported command is
// derived from the ecosystem file itself. `ci`/`test` map to a file that does
// not exist in the repository; the endpoint reports that as an explicit
// exists=false state rather than an error or a silently empty list.
const repoRoot = path.resolve(__dirname, '..', '..');
const monacoPackageDirectory = process.env.JUMENTIX_SERVICE_MANAGEMENT_MONACO_DIR
  ? path.resolve(process.env.JUMENTIX_SERVICE_MANAGEMENT_MONACO_DIR)
  : path.join(repoRoot, 'apps', 'jumentix-website', 'node_modules', 'monaco-editor');
const requireJsFile = require.resolve('requirejs/require');
const pm2EcosystemDirectory = process.env.JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR
  ? path.resolve(process.env.JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR)
  : path.join(repoRoot, 'pm2');
// JUM-770: ecosystem files carry the `.config.cjs` suffix because pm2 only
// treats `.json/.yml/.yaml/.config.js/.config.cjs/.config.mjs` as config
// files (pm2 Common.isConfigFile). A plain `.cjs` file is launched as a
// script — `--only` is ignored and the start reports a phantom success.
const ecosystemFileByRuntime = {
  dev: 'ecosystem.dev.config.cjs',
  development: 'ecosystem.dev.config.cjs',
  staging: 'ecosystem.staging.config.cjs',
  production: 'ecosystem.production.config.cjs',
  prod: 'ecosystem.production.config.cjs',
  ci: 'ecosystem.ci.cjs',
  test: 'ecosystem.ci.cjs'
};

if (!fs.existsSync(configDirectory)) {
  // eslint-disable-next-line no-console
  console.error(`Service Management config directory not found: ${configDirectory}`);
  process.exit(1);
}

const contentTypeByExtension = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // JUM-489: the web app manifest. A dedicated type keeps installability
  // checks honest — browsers accept application/json, but the contract test
  // pins the specific one.
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm'
};

function buildStaticManifest() {
  const manifest = new Map();
  const walk = (currentPath) => {
    let entries;
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return;
      throw error;
    }
    entries.forEach((entry) => {
      const absoluteEntryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) return;
        walk(absoluteEntryPath);
        return;
      }
      const relative = path.relative(rootDirectory, absoluteEntryPath).split(path.sep).join('/');
      manifest.set(relative, absoluteEntryPath);
    });
  };
  walk(rootDirectory);
  return manifest;
}

const staticManifest = buildStaticManifest();

// Static manifest refresh strategy (JUM-463).
//
// The boot-time manifest is a traversal-SAFETY mechanism, not merely a cache:
// serving from a pre-built allowlist bounds the servable surface to files that
// existed at boot, even if path normalisation has a flaw. Production therefore
// serves ONLY the boot manifest. Do NOT make the re-scan below unconditional —
// that would silently drop the safety property.
//
// Development relaxes this because the component is a zero-build vanilla SPA
// edited by hand: a file added after boot would otherwise 404 until restart.
// The dev path re-scans ON MANIFEST MISS ONLY — never per request, or every
// 404 becomes a directory walk (a trivial DoS while the server may bind beyond
// localhost, see JUM-462) — and the retry goes through the same
// containment-validated lookup as a boot-time hit, so the re-scan is not a
// bypass around the check the manifest provides.
//
// Mode selection is explicit configuration, not inferred from NODE_ENV alone:
// JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH=on-miss|boot-only wins
// when set; otherwise the default derives from NODE_ENV (dev/development =>
// on-miss, anything else => boot-only).
const staticManifestRefreshSetting = String(
  process.env.JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH || ''
).trim().toLowerCase();
const nodeEnvironment = String(process.env.NODE_ENV || 'dev').trim().toLowerCase();
const staticManifestRefreshEnabled = staticManifestRefreshSetting
  ? staticManifestRefreshSetting === 'on-miss'
  : nodeEnvironment === 'dev' || nodeEnvironment === 'development';

function refreshStaticManifest() {
  const rebuilt = buildStaticManifest();
  staticManifest.clear();
  rebuilt.forEach((absoluteEntryPath, relativeEntryPath) => {
    staticManifest.set(relativeEntryPath, absoluteEntryPath);
  });
}

function findStaticFile(relativePath) {
  const filePath = staticManifest.get(relativePath);
  if (!filePath) return null;
  // Containment validation applied to every hit — boot-time or freshly
  // re-scanned — so a manifest entry can never resolve outside the static
  // root, whichever scan produced it.
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(`${rootDirectory}${path.sep}`)) return null;
  return resolvedPath;
}

function resolveRequestPath(urlPath) {
  const cleanPath = String(urlPath || '/').split('?')[0];
  const normalized = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const safePath = path.posix.normalize(`/${normalized}`).replace(/^\/+/, '');
  if (!safePath || safePath.includes('..')) return null;
  return safePath;
}

function findMonacoFile(urlPath) {
  const prefix = '/vendor/monaco/';
  if (!String(urlPath || '').startsWith(prefix)) return null;
  const relative = path.posix.normalize(String(urlPath).slice(prefix.length));
  if (!relative || relative.startsWith('..') || relative.includes('/../')) return null;
  const resolvedPath = path.resolve(monacoPackageDirectory, relative);
  if (!resolvedPath.startsWith(`${monacoPackageDirectory}${path.sep}`)) return null;
  return fs.existsSync(resolvedPath) ? resolvedPath : null;
}

function serveFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.statusCode = error.code === 'ENOENT' ? 404 : 500;
      response.end(error.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    response.setHeader('Content-Type', contentTypeByExtension[extension] || 'application/octet-stream');
    response.statusCode = 200;
    response.end(content);
  });
}

function normalizeEnvironment(runtime) {
  const fallback = process.env.NODE_ENV || 'dev';
  const selected = String(runtime || fallback).trim().toLowerCase();
  if (!envFileByRuntime[selected]) {
    const accepted = Object.keys(envFileByRuntime).join(', ');
    const error = new Error(`Unsupported environment "${selected}". Accepted values: ${accepted}`);
    // Tagged so the HTTP layer can tell a client error (400) apart from a
    // filesystem failure (500) — JUM-543.
    error.code = 'UNSUPPORTED_ENVIRONMENT';
    throw error;
  }
  return selected;
}

// Same explicit-resolution discipline as normalizeEnvironment (JUM-558), over
// the ecosystem-file accepted set — a superset that includes production, which
// has an ecosystem but no editable env file.
function normalizeEcosystemEnvironment(runtime) {
  const fallback = process.env.NODE_ENV || 'dev';
  const selected = String(runtime || fallback).trim().toLowerCase();
  if (!ecosystemFileByRuntime[selected]) {
    const accepted = Object.keys(ecosystemFileByRuntime).join(', ');
    const error = new Error(`Unsupported environment "${selected}". Accepted values: ${accepted}`);
    error.code = 'UNSUPPORTED_ENVIRONMENT';
    throw error;
  }
  return selected;
}

function resolveEnvFilePath(runtime) {
  const normalizedEnvironment = normalizeEnvironment(runtime);
  const envFileName = envFileByRuntime[normalizedEnvironment];
  return {
    environment: normalizedEnvironment,
    filePath: path.join(configDirectory, envFileName),
    fileName: envFileName
  };
}

function parseEnvContent(envContent) {
  const values = {};
  const lines = String(envContent || '').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) return;
    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key) return;
    const value = rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue;
    values[key] = value;
  });
  return values;
}

function toEnvFileValue(rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) return '';
  if (/[\s#]/.test(value)) {
    // Backslashes first: escaping quotes before them would double-escape the
    // backslash of a `\"` pair and corrupt the value dotenv reads back.
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

function validateWebsocketRedisUrl(value) {
  if (value === '') return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    return 'must be a valid redis:// URL';
  }
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    return 'must use the redis:// or rediss:// protocol';
  }
  if (parsed.username || parsed.password) {
    return 'must not embed credentials; credential-bearing values are never writable through this endpoint';
  }
  return null;
}

// Returns an error message when the value is out of contract, null otherwise.
function validateRuntimeValue(key, rawValue) {
  const value = String(rawValue ?? '').trim();
  if (key === 'JUMENTIX_WEBSOCKET_REDIS_URL') {
    const urlError = validateWebsocketRedisUrl(value);
    return urlError ? `Invalid value for ${key}: ${urlError}.` : null;
  }
  const requiredEnum = runtimeKeyEnums[key];
  if (requiredEnum && !requiredEnum.includes(value)) {
    return `Unsupported value "${value}" for ${key}. Accepted values: ${requiredEnum.join(', ')}`;
  }
  const optionalEnum = optionalRuntimeKeyEnums[key];
  if (optionalEnum && value !== '' && !optionalEnum.includes(value)) {
    return `Unsupported value "${value}" for ${key}. Accepted values: ${optionalEnum.join(', ')} (empty keeps the backend default)`;
  }
  return null;
}

function readRuntimeEnv(runtime) {
  const resolved = resolveEnvFilePath(runtime);
  if (!fs.existsSync(resolved.filePath)) {
    const error = new Error(`Environment file not found: ${resolved.filePath}`);
    error.code = 'ENV_FILE_NOT_FOUND';
    error.filePath = resolved.filePath;
    throw error;
  }
  const fileContent = fs.readFileSync(resolved.filePath, 'utf8');
  const parsed = parseEnvContent(fileContent);
  const runtimeValues = {};
  editableRuntimeKeys.forEach((key) => {
    runtimeValues[key] = parsed[key] || defaultsByRuntimeKey[key] || '';
  });
  readOnlyRuntimeKeys.forEach((key) => {
    runtimeValues[key] = parsed[key] || '';
  });
  return {
    environment: resolved.environment,
    fileName: resolved.fileName,
    editableKeys: [...editableRuntimeKeys],
    values: runtimeValues
  };
}

function updateRuntimeEnv(runtime, values) {
  const resolved = resolveEnvFilePath(runtime);
  if (!fs.existsSync(resolved.filePath)) {
    const error = new Error(`Environment file not found: ${resolved.filePath}`);
    error.code = 'ENV_FILE_NOT_FOUND';
    error.filePath = resolved.filePath;
    throw error;
  }
  const currentContent = fs.readFileSync(resolved.filePath, 'utf8');
  const lines = String(currentContent).split(/\r?\n/);
  const updates = {};
  const validationErrors = [];
  editableRuntimeKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      const validationError = validateRuntimeValue(key, values[key]);
      if (validationError) {
        validationErrors.push(validationError);
        return;
      }
      updates[key] = toEnvFileValue(values[key]);
    }
  });
  if (validationErrors.length > 0) {
    // Client-supplied values out of contract: tagged so the HTTP layer keeps
    // these on the 400 payload envelope instead of the 500 filesystem class.
    const error = new Error(validationErrors.join(' '));
    error.code = 'INVALID_RUNTIME_VALUE';
    throw error;
  }

  Object.entries(updates).forEach(([key, value]) => {
    const keyExpression = new RegExp(`^\\s*#?\\s*${key}=`);
    const lineIndex = lines.findIndex((line) => keyExpression.test(line));
    const nextLine = `${key}=${value}`;
    if (lineIndex >= 0) {
      lines[lineIndex] = nextLine;
    } else {
      lines.push(nextLine);
    }
  });

  const finalContent = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  const contentToWrite = finalContent.endsWith('\n') ? finalContent : `${finalContent}\n`;
  const tempPath = `${resolved.filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, contentToWrite, 'utf8');
  const fd = fs.openSync(tempPath, 'r+');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tempPath, resolved.filePath);

  return readRuntimeEnv(resolved.environment);
}

// Reads the PM2 ecosystem for an environment (JUM-480). The ecosystem module
// is loaded cache-busted, so editing pm2/ecosystem.*.cjs is reflected on the
// next read without a server restart. A missing file is NOT an error: it is
// the explicit `exists: false` state the preview renders for environments
// without an ecosystem (e.g. ci). An unreadable or syntactically broken file
// throws with a 500-class code/path envelope, same discipline as the env-file
// API (JUM-543).
function readPm2Ecosystem(runtime) {
  const environment = normalizeEcosystemEnvironment(runtime);
  const fileName = ecosystemFileByRuntime[environment];
  const filePath = path.join(pm2EcosystemDirectory, fileName);
  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
  if (!fs.existsSync(filePath)) {
    return {
      environment,
      fileName,
      path: relativePath,
      exists: false,
      apps: []
    };
  }
  let ecosystem;
  try {
    delete require.cache[require.resolve(filePath)];
    // eslint-disable-next-line global-require, import/no-dynamic-require
    ecosystem = require(filePath);
  } catch (error) {
    const loadError = new Error(
      `Could not load PM2 ecosystem file: ${filePath} (${error instanceof Error ? error.message : String(error)})`
    );
    loadError.code = error instanceof Error && typeof error.code === 'string' && error.code
      ? error.code
      : 'ECOSYSTEM_LOAD_ERROR';
    loadError.filePath = filePath;
    throw loadError;
  }
  const apps = Array.isArray(ecosystem?.apps) ? ecosystem.apps : [];
  return {
    environment,
    fileName,
    path: relativePath,
    exists: true,
    apps: apps.map((app) => {
      const name = String(app?.name || '');
      const appEnv = app && typeof app.env === 'object' && app.env !== null ? app.env : {};
      return {
        name,
        script: String(app?.script || ''),
        interpreter: app?.interpreter ? String(app.interpreter) : '',
        interpreterArgs: app?.interpreter_args ? String(app.interpreter_args) : '',
        env: appEnv,
        // Derived from the ecosystem definition — never a package-manager
        // string, so the Bun cutover cannot invalidate it (JUM-480).
        command: `pm2 start ${relativePath} --only ${name} --update-env`
      };
    })
  };
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizePm2Process(processEntry) {
  const pm2Env = processEntry?.pm2_env || {};
  const monit = processEntry?.monit || {};
  const uptime = toFiniteNumber(pm2Env.pm_uptime);
  const startedAt = uptime > 0 ? new Date(uptime).toISOString() : '';
  const uptimeMs = uptime > 0 ? Math.max(0, Date.now() - uptime) : 0;
  const customMetrics = {};
  const axmMonitor = pm2Env.axm_monitor && typeof pm2Env.axm_monitor === 'object'
    ? pm2Env.axm_monitor
    : {};
  Object.entries(axmMonitor).forEach(([key, metric]) => {
    const value = metric && typeof metric === 'object' && 'value' in metric ? metric.value : metric;
    customMetrics[key] = value;
  });
  const axmActions = Array.isArray(pm2Env.axm_actions)
    ? pm2Env.axm_actions.map((action) => (action && typeof action === 'object' ? action.action_name || action.name : action)).filter(Boolean)
    : [];
  return {
    name: String(processEntry?.name || pm2Env.name || ''),
    pmId: processEntry?.pm_id === undefined ? null : toFiniteNumber(processEntry.pm_id, null),
    pid: processEntry?.pid === undefined ? null : toFiniteNumber(processEntry.pid, null),
    namespace: String(pm2Env.namespace || 'default'),
    status: String(pm2Env.status || 'unknown'),
    cpuPercent: toFiniteNumber(monit.cpu),
    memoryBytes: toFiniteNumber(monit.memory),
    restartCount: toFiniteNumber(pm2Env.restart_time),
    unstableRestarts: toFiniteNumber(pm2Env.unstable_restarts),
    uptimeMs,
    startedAt,
    script: String(pm2Env.pm_exec_path || ''),
    interpreter: String(pm2Env.exec_interpreter || ''),
    execMode: String(pm2Env.exec_mode || ''),
    instances: toFiniteNumber(pm2Env.instances, 1),
    watching: Boolean(pm2Env.watch),
    nodeVersion: String(pm2Env.node_version || ''),
    version: String(pm2Env.version || pm2Env.axm_options?.module_version || ''),
    exitCode: pm2Env.exit_code === undefined || pm2Env.exit_code === null
      ? null
      : toFiniteNumber(pm2Env.exit_code, null),
    axmActions,
    customMetrics,
    asyncContext: null,
    pm2_env: {
      namespace: String(pm2Env.namespace || 'default'),
      status: String(pm2Env.status || 'unknown'),
      pm_exec_path: String(pm2Env.pm_exec_path || ''),
      exec_interpreter: String(pm2Env.exec_interpreter || ''),
      JUMENTIX_HTTP_PORT: pm2Env.JUMENTIX_HTTP_PORT
        || (pm2Env.env && pm2Env.env.JUMENTIX_HTTP_PORT)
        || undefined
    },
    env: pm2Env.env && typeof pm2Env.env === 'object'
      ? { JUMENTIX_HTTP_PORT: pm2Env.env.JUMENTIX_HTTP_PORT }
      : {}
  };
}

function summarizePm2Processes(processes) {
  const statusCounts = processes.reduce((counts, processEntry) => {
    counts[processEntry.status] = (counts[processEntry.status] || 0) + 1;
    return counts;
  }, {});
  const totalCpuPercent = processes.reduce((total, processEntry) => total + processEntry.cpuPercent, 0);
  const totalMemoryBytes = processes.reduce((total, processEntry) => total + processEntry.memoryBytes, 0);
  return {
    processCount: processes.length,
    onlineCount: statusCounts.online || 0,
    stoppedCount: statusCounts.stopped || 0,
    erroredCount: statusCounts.errored || 0,
    totalCpuPercent,
    totalMemoryBytes,
    statusCounts
  };
}

function readPm2ProcessList() {
  // Serialized (pm2DaemonLock): the pm2 module is a singleton — a concurrent
  // disconnect would kill this RPC mid-flight (JUM-770).
  return withPm2DaemonLock(() => new Promise((resolve, reject) => {
    let pm2;
    try {
      pm2 = loadPm2Module();
    } catch (error) {
      reject(error);
      return;
    }
    pm2.connect((connectError) => {
      if (connectError) {
        reject(connectError);
        return;
      }
      pm2.list((listError, processList) => {
        try {
          pm2.disconnect();
        } catch (_disconnectError) {
          // Disconnect best-effort: a failed disconnect must not hide the PM2
          // list result, because the endpoint is read-only.
        }
        if (listError) {
          reject(listError);
          return;
        }
        resolve(Array.isArray(processList) ? processList : []);
      });
    });
  }));
}

async function readPm2Metrics(runtime) {
  const environment = normalizeEcosystemEnvironment(runtime);
  const ecosystem = readPm2Ecosystem(environment);
  const expectedNames = new Set((ecosystem.apps || []).map((app) => app.name).filter(Boolean));
  const processes = (await readPm2ProcessList()).map(normalizePm2Process);
  const processNames = new Set(processes.map((processEntry) => processEntry.name));
  const missingExpected = [...expectedNames].filter((name) => !processNames.has(name)).sort((a, b) => a.localeCompare(b));
  const summary = summarizePm2Processes(processes);
  const { processes: withAsyncContext, asyncContextActiveSum } = await attachAsyncContextMetrics(
    processes,
    { ecosystemApps: ecosystem.apps || [] }
  );
  const withDiskIo = await attachProcessDiskIo(withAsyncContext);
  const host = await collectHostMetrics({
    projectRoot: path.resolve(__dirname, '../..'),
    processRssSumBytes: summary.totalMemoryBytes,
    processCpuPercentSum: summary.totalCpuPercent
  });
  return {
    source: 'pm2',
    collectedAt: new Date().toISOString(),
    environment,
    ecosystem: {
      fileName: ecosystem.fileName,
      path: ecosystem.path,
      exists: ecosystem.exists,
      expectedProcessCount: expectedNames.size,
      missingExpected
    },
    summary: {
      ...summary,
      asyncContextActiveSum
    },
    host,
    processes: withDiskIo
  };
}

function loadPm2Module() {
  const pm2Module = process.env.JUMENTIX_SERVICE_MANAGEMENT_PM2_MODULE || 'pm2';
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(pm2Module);
}

function runPm2Method(methodName, ...args) {
  // Serialized (pm2DaemonLock): same singleton-client race as
  // readPm2ProcessList — an overlapping disconnect hangs the action (JUM-770).
  return withPm2DaemonLock(() => new Promise((resolve, reject) => {
    let pm2;
    try {
      pm2 = loadPm2Module();
    } catch (error) {
      reject(error);
      return;
    }
    pm2.connect((connectError) => {
      if (connectError) {
        reject(connectError);
        return;
      }
      const method = pm2[methodName];
      if (typeof method !== 'function') {
        try { pm2.disconnect(); } catch (_error) { /* ignore */ }
        reject(new Error(`PM2 method not available: ${methodName}`));
        return;
      }
      method.call(pm2, ...args, (error, result) => {
        try { pm2.disconnect(); } catch (_error) { /* ignore */ }
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }));
}

// Lifecycle rules (start verification, service-manager self-guard, bulk
// skip-and-report) live in src/runtime/pm2Lifecycle.js (JUM-770) where they
// are unit-testable without a PM2 daemon; this is only the wiring.
const runPm2Action = createPm2ActionRunner({
  normalizeEnvironment: normalizeEcosystemEnvironment,
  readEcosystem: readPm2Ecosystem,
  listProcesses: async () => (await readPm2ProcessList()).map(normalizePm2Process),
  runMethod: runPm2Method
});

function writeJson(response, statusCode, payload) {
  const sanitizedJson = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.write(sanitizedJson);
  response.end();
}

// Error-contract split (JUM-543, Requirement 126 §3): parse and validation
// failures are client errors (400); filesystem failures are a distinct,
// identifiable server-side class (500) carrying the error code and the
// resolved env-file path, so a broken installation is never mistaken for a
// malformed request.
function isUnsupportedEnvironmentError(error) {
  return error instanceof Error && error.code === 'UNSUPPORTED_ENVIRONMENT';
}

function isRuntimeValueError(error) {
  return error instanceof Error && error.code === 'INVALID_RUNTIME_VALUE';
}

// The detail string that may cross the wire in an error envelope. For an
// Error this is the message only; a thrown non-Error is interpolated, which
// is its toString — neither form ever carries stack frames, so a response can
// never leak trace information (CWE-209).
function errorDetails(error) {
  return error instanceof Error ? error.message : `${error}`;
}

function writeInvalidEnvironment(response, error) {
  writeJson(response, 400, {
    error: 'Invalid environment request.',
    details: errorDetails(error)
  });
}

function writeInvalidPayload(response, error) {
  writeJson(response, 400, {
    error: 'Invalid payload.',
    details: errorDetails(error)
  });
}

function writeEnvironmentFileFailure(response, error) {
  const code = error instanceof Error && error.code ? String(error.code) : 'ENV_IO_ERROR';
  const filePath = error instanceof Error
    ? (error.filePath || error.path || null)
    : null;
  writeJson(response, 500, {
    error: 'Environment file operation failed.',
    code,
    path: filePath ? String(filePath) : null,
    details: errorDetails(error)
  });
}

// Same honest 500 envelope as the env-file class (JUM-543), named for the
// ecosystem surface so a broken pm2/ecosystem.*.cjs is identifiable (JUM-480).
function writeEcosystemFileFailure(response, error) {
  const code = error instanceof Error && error.code ? String(error.code) : 'ECOSYSTEM_IO_ERROR';
  const filePath = error instanceof Error
    ? (error.filePath || error.path || null)
    : null;
  writeJson(response, 500, {
    error: 'PM2 ecosystem file operation failed.',
    code,
    path: filePath ? String(filePath) : null,
    details: errorDetails(error)
  });
}

function writePm2MetricsFailure(response, error) {
  const code = error instanceof Error && error.code ? String(error.code) : 'PM2_METRICS_ERROR';
  writeJson(response, 500, {
    error: 'PM2 metrics collection failed.',
    code,
    details: errorDetails(error)
  });
}

function readBody(request, callback) {
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    callback(body);
  });
}

function isAuthorized(request) {
  if (!authToken) return true;
  const authHeader = request.headers.authorization || '';
  return authHeader === `Bearer ${authToken}`;
}

function logMutation(environment, changedKeys) {
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}] /api/runtime/env mutation: environment=${environment} keys=${changedKeys.join(',')}`);
}

/**
 * Dev-only live reload (SSE).
 *
 * The designer is edited by reloading the page after every change, and the
 * page carries unsaved canvas state — so "did my change land?" was answered by
 * a manual reload that also threw away what was on screen. This pushes one
 * event when a served file changes and lets the page reload itself.
 *
 * It is a development affordance and stays out of anything else: the endpoint
 * is not registered, the watcher is not started and nothing is injected into
 * `index.html` unless `NODE_ENV` is dev/development. Setting
 * `JUMENTIX_SERVICE_MANAGEMENT_LIVE_RELOAD=0` turns it off there too.
 */
const liveReloadEnabled = (nodeEnvironment === 'dev' || nodeEnvironment === 'development')
  && String(process.env.JUMENTIX_SERVICE_MANAGEMENT_LIVE_RELOAD || '').trim() !== '0';
const liveReloadPath = '/dev/live-reload';
const liveReloadClients = new Set();
const liveReloadSnippet = `<script>
(function () {
  var connected = false;
  function connect() {
    var source = new EventSource(${JSON.stringify(liveReloadPath)});
    source.addEventListener('reload', function () { window.location.reload(); });
    source.addEventListener('open', function () {
      // Reconnecting means the server restarted underneath us — pm2 watches
      // this tree and restarts on every save, which kills the stream before it
      // can push anything. Without reloading here the page kept running the
      // code it had loaded before the change, which is exactly the "I am not
      // seeing the new version" failure this is meant to remove.
      if (connected) { window.location.reload(); return; }
      connected = true;
    });
    source.addEventListener('error', function () {
      // The browser retries an EventSource on its own, but not once the server
      // has gone away long enough for it to give up. Re-arm so a restart that
      // takes a while still ends with the page reloading.
      if (source.readyState === 2) { source.close(); setTimeout(connect, 400); }
    });
  }
  connect();
})();
</script>`;

let liveReloadTimer = null;
function notifyLiveReloadClients() {
  // Debounced: one save can emit several watcher events, and a bundle sync
  // rewrites twenty files at once — each would otherwise be its own reload.
  if (liveReloadTimer) clearTimeout(liveReloadTimer);
  liveReloadTimer = setTimeout(() => {
    liveReloadTimer = null;
    liveReloadClients.forEach((client) => {
      client.write('event: reload\ndata: 1\n\n');
    });
  }, 120);
}

function startLiveReloadWatcher() {
  try {
    fs.watch(rootDirectory, { recursive: true }, (_eventType, fileName) => {
      // The manifest is a boot-time scan; a new file has to enter it before it
      // can be served, and the page is about to ask for it.
      if (staticManifestRefreshEnabled) refreshStaticManifest();
      if (fileName) notifyLiveReloadClients();
    });
  } catch (error) {
    // A watcher that cannot start is not a reason to refuse to serve the app.
    // eslint-disable-next-line no-console
    console.warn(`Live reload disabled: ${error.message}`);
  }
}

function openLiveReloadStream(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  response.write('retry: 500\n\n');
  liveReloadClients.add(response);
  request.on('close', () => {
    liveReloadClients.delete(response);
  });
}

/** `index.html` with the reload client appended, in dev only. */
function withLiveReloadSnippet(content) {
  const html = content.toString('utf8');
  if (html.includes(liveReloadPath)) return html;
  return html.includes('</body>')
    ? html.replace('</body>', `${liveReloadSnippet}\n</body>`)
    : `${html}${liveReloadSnippet}`;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${host}:${port}`);
  if (liveReloadEnabled && request.method === 'GET' && requestUrl.pathname === liveReloadPath) {
    openLiveReloadStream(request, response);
    return;
  }
  if (request.method === 'GET' && requestUrl.pathname === '/api/runtime/env') {
    try {
      const environment = requestUrl.searchParams.get('environment') || process.env.NODE_ENV || 'dev';
      const payload = readRuntimeEnv(environment);
      writeJson(response, 200, payload);
    } catch (error) {
      if (isUnsupportedEnvironmentError(error)) {
        writeInvalidEnvironment(response, error);
        return;
      }
      writeEnvironmentFileFailure(response, error);
    }
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/runtime/pm2-ecosystem') {
    try {
      const environment = requestUrl.searchParams.get('environment') || process.env.NODE_ENV || 'dev';
      const payload = readPm2Ecosystem(environment);
      writeJson(response, 200, payload);
    } catch (error) {
      if (isUnsupportedEnvironmentError(error)) {
        writeInvalidEnvironment(response, error);
        return;
      }
      writeEcosystemFileFailure(response, error);
    }
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/runtime/pm2-metrics') {
    const environment = requestUrl.searchParams.get('environment') || process.env.NODE_ENV || 'dev';
    readPm2Metrics(environment)
      .then((payload) => writeJson(response, 200, payload))
      .catch((error) => {
        if (isUnsupportedEnvironmentError(error)) {
          writeInvalidEnvironment(response, error);
          return;
        }
        writePm2MetricsFailure(response, error);
      });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/runtime/env') {
    if (!isAuthorized(request)) {
      writeJson(response, 401, { error: 'Unauthorized.' });
      return;
    }
    readBody(request, (rawBody) => {
      // Parse errors are the only 400 "Invalid payload" class here: the try is
      // narrowed to JSON.parse so a filesystem failure inside updateRuntimeEnv
      // can never be reported as a malformed request (JUM-543).
      let parsed;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : {};
      } catch (error) {
        writeInvalidPayload(response, error);
        return;
      }
      const environment = parsed.environment || process.env.NODE_ENV || 'dev';
      try {
        const payload = updateRuntimeEnv(environment, parsed.values || {});
        logMutation(environment, Object.keys(parsed.values || {}));
        writeJson(response, 200, payload);
      } catch (error) {
        if (isUnsupportedEnvironmentError(error)) {
          writeInvalidEnvironment(response, error);
          return;
        }
        if (isRuntimeValueError(error)) {
          writeInvalidPayload(response, error);
          return;
        }
        writeEnvironmentFileFailure(response, error);
      }
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/vendor/requirejs/require.js') {
    serveFile(response, requireJsFile);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/favicon.ico') {
    serveFile(response, path.join(rootDirectory, 'icons/icon.svg'));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/vendor/monaco/')) {
    const filePath = findMonacoFile(requestUrl.pathname);
    if (!filePath) {
      response.statusCode = 404;
      response.end('Not Found');
      return;
    }
    serveFile(response, filePath);
    return;
  }

  const relativePath = resolveRequestPath(request.url);
  if (!relativePath) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }
  let filePath = findStaticFile(relativePath);
  if (!filePath && staticManifestRefreshEnabled) {
    // Dev-only, miss-only re-scan (see the strategy note above): refresh once,
    // then retry through the same containment-validated lookup. A genuinely
    // absent path still 404s.
    refreshStaticManifest();
    filePath = findStaticFile(relativePath);
  }
  if (!filePath) {
    response.statusCode = 404;
    response.end('Not Found');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        response.statusCode = 404;
        response.end('Not Found');
        return;
      }
      response.statusCode = 500;
      response.end('Internal Server Error');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.setHeader('Content-Type', contentTypeByExtension[extension] || 'application/octet-stream');
    response.statusCode = 200;
    if (liveReloadEnabled && relativePath === 'index.html') {
      response.end(withLiveReloadSnippet(content));
      return;
    }
    response.end(content);
  });
});

server.listen(port, host, () => {
  if (liveReloadEnabled) startLiveReloadWatcher();
  // eslint-disable-next-line no-console
  console.log(`Service Management listening on http://${host}:${port}`);
});

createPm2WsHub(server, {
  collectMetrics: async ({ environment }) => readPm2Metrics(environment || 'dev'),
  runAction: runPm2Action,
  isAuthorized: (token) => {
    if (!authToken) return true;
    return token === authToken || token === `Bearer ${authToken}`;
  }
});
