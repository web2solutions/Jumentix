const fs = require('fs');
const path = require('path');
const http = require('http');

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
  'JUMENTIX_AUTH_LOCKOUT_SECONDS'
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
  JUMENTIX_WEBSOCKET_REDIS_URL: ''
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
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function buildStaticManifest() {
  const manifest = new Map();
  const walk = (currentPath) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
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

function resolveRequestPath(urlPath) {
  const cleanPath = String(urlPath || '/').split('?')[0];
  const normalized = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  const safePath = path.posix.normalize(`/${normalized}`).replace(/^\/+/, '');
  if (!safePath || safePath.includes('..')) return null;
  return safePath;
}

function normalizeEnvironment(runtime) {
  const fallback = process.env.NODE_ENV || 'dev';
  const selected = String(runtime || fallback).trim().toLowerCase();
  if (!envFileByRuntime[selected]) {
    const accepted = Object.keys(envFileByRuntime).join(', ');
    throw new Error(`Unsupported environment "${selected}". Accepted values: ${accepted}`);
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
    return `"${value.replace(/"/g, '\\"')}"`;
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
    throw new Error(validationErrors.join(' '));
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

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${host}:${port}`);
  if (request.method === 'GET' && requestUrl.pathname === '/api/runtime/env') {
    try {
      const environment = requestUrl.searchParams.get('environment') || process.env.NODE_ENV || 'dev';
      const payload = readRuntimeEnv(environment);
      writeJson(response, 200, payload);
    } catch (error) {
      writeJson(response, 400, {
        error: 'Invalid environment request.',
        details: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/runtime/env') {
    if (!isAuthorized(request)) {
      writeJson(response, 401, { error: 'Unauthorized.' });
      return;
    }
    readBody(request, (rawBody) => {
      try {
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const environment = parsed.environment || process.env.NODE_ENV || 'dev';
        const payload = updateRuntimeEnv(environment, parsed.values || {});
        logMutation(environment, Object.keys(parsed.values || {}));
        writeJson(response, 200, payload);
      } catch (error) {
        writeJson(response, 400, {
          error: 'Invalid payload.',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    });
    return;
  }

  const relativePath = resolveRequestPath(request.url);
  if (!relativePath) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }
  const filePath = staticManifest.get(relativePath);
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
    response.end(content);
  });
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Service Management listening on http://${host}:${port}`);
});
