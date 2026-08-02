const fs = require('fs');
const path = require('path');
const http = require('http');

const rootDirectory = __dirname;
const projectRoot = path.resolve(__dirname, '..');
const configDirectory = path.join(projectRoot, 'src', 'config');
const host = process.env.JUMENTIX_SERVICE_MANAGEMENT_HOST || '0.0.0.0';
const port = Number(process.env.JUMENTIX_SERVICE_MANAGEMENT_PORT || 3200);
const editableRuntimeKeys = [
  'JUMENTIX_HTTP_FRAMEWORK',
  'JUMENTIX_REALTIME_API',
  'JUMENTIX_REALTIME_API_PROTOCOL',
  'JUMENTIX_REALTIME_API_DATABASE_DRIVER'
];
const defaultsByRuntimeKey = {
  JUMENTIX_HTTP_FRAMEWORK: 'express',
  JUMENTIX_REALTIME_API: 'no',
  JUMENTIX_REALTIME_API_PROTOCOL: 'websocket',
  JUMENTIX_REALTIME_API_DATABASE_DRIVER: 'Mongo'
};
const envFileByRuntime = {
  dev: '.env.dev',
  development: '.env.dev',
  staging: '.env.staging',
  ci: '.env.ci',
  test: '.env.ci'
};

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
  return envFileByRuntime[selected] ? selected : 'dev';
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

function readRuntimeEnv(runtime) {
  const resolved = resolveEnvFilePath(runtime);
  const fileContent = fs.existsSync(resolved.filePath)
    ? fs.readFileSync(resolved.filePath, 'utf8')
    : '';
  const parsed = parseEnvContent(fileContent);
  const runtimeValues = {};
  editableRuntimeKeys.forEach((key) => {
    runtimeValues[key] = parsed[key] || defaultsByRuntimeKey[key] || '';
  });
  return {
    environment: resolved.environment,
    fileName: resolved.fileName,
    values: runtimeValues
  };
}

function updateRuntimeEnv(runtime, values) {
  const resolved = resolveEnvFilePath(runtime);
  const currentContent = fs.existsSync(resolved.filePath)
    ? fs.readFileSync(resolved.filePath, 'utf8')
    : '';
  const lines = String(currentContent).split(/\r?\n/);
  const updates = {};
  editableRuntimeKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      updates[key] = toEnvFileValue(values[key]);
    }
  });

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
  fs.writeFileSync(resolved.filePath, finalContent.endsWith('\n') ? finalContent : `${finalContent}\n`, 'utf8');

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

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${host}:${port}`);
  if (request.method === 'GET' && requestUrl.pathname === '/api/runtime/env') {
    const payload = readRuntimeEnv(process.env.NODE_ENV || 'dev');
    writeJson(response, 200, payload);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/runtime/env') {
    readBody(request, (rawBody) => {
      try {
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        const payload = updateRuntimeEnv(process.env.NODE_ENV || 'dev', parsed.values || {});
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
