import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const sitePort = Number(process.env.JUMENTIX_WEBSITE_PORT ?? '3010');
const baseUrl = `http://127.0.0.1:${sitePort}`;
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const runCommand = (command, args, extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv }
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });

const startServer = () =>
  spawn(pnpmCommand, ['run', 'start'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(sitePort) }
  });

const assertRoute = async ({
  path,
  expectedStatus = 200,
  includes = [],
  excludes = [],
  headers = {}
}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'text/html,application/json', ...headers }
  });

  if (response.status !== expectedStatus) {
    throw new Error(`Route ${path} expected ${expectedStatus}, received ${response.status}`);
  }

  const body = await response.text();

  for (const content of includes) {
    if (!body.includes(content)) {
      throw new Error(`Route ${path} did not include expected content: ${content}`);
    }
  }

  for (const content of excludes) {
    if (body.includes(content)) {
      throw new Error(`Route ${path} included forbidden content: ${content}`);
    }
  }
};

const extractInternalPaths = (body) => {
  const paths = new Set();
  const hrefPattern = /href="([^"]+)"/g;
  for (const match of body.matchAll(hrefPattern)) {
    const href = match[1];
    if (!href?.startsWith('/') || href.startsWith('/_next')) continue;
    paths.add(href.replaceAll('&amp;', '&'));
  }
  return [...paths];
};

const assertInternalLinks = async (sourcePaths) => {
  const discovered = new Set();
  for (const sourcePath of sourcePaths) {
    const response = await fetch(`${baseUrl}${sourcePath}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'text/html' }
    });
    const body = await response.text();
    for (const path of extractInternalPaths(body)) discovered.add(path);
  }

  for (const path of discovered) {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
      headers: { Accept: 'text/html,application/json' }
    });
    if (response.status >= 400) {
      throw new Error(`Internal link ${path} returned ${response.status}`);
    }
  }
};

const waitForServer = async () => {
  const deadline = Date.now() + 90_000;
  const errors = [];

  while (Date.now() < deadline) {
    try {
      await assertRoute({
        path: '/',
        expectedStatus: 200,
        includes: ['Jumentix']
      });
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      await delay(1000);
    }
  }

  throw new Error(`Website did not become ready on ${baseUrl}. Last errors: ${errors.slice(-3).join(' | ')}`);
};

const smokeRoutes = async () => {
  const invalidMarkers = [
    'Missing ConfigContext.Provider',
    'Cannot find module',
    'Element type is invalid',
    'Source file not found:',
    'Internal Server Error'
  ];

  await assertRoute({ path: '/', includes: ['Jumentix'], excludes: invalidMarkers });
  const englishRoutes = [
    ['/', ['Open-source software factory', 'Domain Designer']],
    ['/product', ['A software factory your teams can evolve', 'Platform capabilities']],
    ['/use-cases', ['Start with the product you need now', 'REST API']],
    ['/use-cases/rest-api', ['Contract-first REST APIs', 'OpenAPI 3.1']],
    ['/use-cases/realtime-api', ['Bidirectional APIs', 'Socket.IO']],
    ['/use-cases/saas-monolith', ['Launch one deployable', 'Lower first-release']],
    ['/use-cases/saas-microservices', ['Scale services', 'Request/response']],
    ['/use-cases/spa-pwa', ['keep working offline', 'IndexedDB']],
    ['/integrations', ['Choose infrastructure per service', 'MongoDB']],
    ['/architecture', ['Domain ownership at the center', 'Application core']],
    ['/security-compliance', ['Controls your audit can verify', 'RBAC']],
    ['/community', ['Build the factory with us', 'Every contribution']],
    ['/roadmap', ['A public path', 'Monorepo consolidation']],
    ['/contact', ['Bring your architecture challenge', 'GitHub Discussions']],
    ['/pricing-or-engagement', ['Open source foundation', 'Product pilot']],
  ];
  const portugueseRoutes = [
    ['/pt-BR', ['Fábrica de software open source', 'Domain Designer']],
    ['/pt-BR/product', ['Uma fábrica de software', 'Capacidades da plataforma']],
    ['/pt-BR/use-cases', ['Comece com o produto', 'API REST']],
    ['/pt-BR/use-cases/rest-api', ['APIs REST orientadas', 'OpenAPI 3.1']],
    ['/pt-BR/use-cases/realtime-api', ['APIs bidirecionais', 'Socket.IO']],
    ['/pt-BR/use-cases/saas-monolith', ['Lance um deploy', 'Menor custo']],
    ['/pt-BR/use-cases/saas-microservices', ['Escale serviços', 'request/response']],
    ['/pt-BR/use-cases/spa-pwa', ['continuam funcionando offline', 'IndexedDB']],
    ['/pt-BR/integrations', ['Escolha a infraestrutura', 'MongoDB']],
    ['/pt-BR/architecture', ['Domínio no centro', 'Núcleo da aplicação']],
    ['/pt-BR/security-compliance', ['Controles que sua auditoria', 'RBAC']],
    ['/pt-BR/community', ['Construa a fábrica conosco', 'Toda contribuição']],
    ['/pt-BR/roadmap', ['Um caminho público', 'Consolidação do monorepo']],
    ['/pt-BR/contact', ['Traga seu desafio', 'GitHub Discussions']],
    ['/pt-BR/pricing-or-engagement', ['Fundação open source', 'Piloto de produto']],
  ];

  for (const [path, includes] of [...englishRoutes, ...portugueseRoutes]) {
    await assertRoute({ path, includes, excludes: invalidMarkers });
  }

  await assertRoute({ path: '/changelog?page=1', includes: ['Jumentix changelog'], excludes: invalidMarkers });
  await assertRoute({ path: '/pt-BR/changelog?page=1', includes: ['Changelog do Jumentix'], excludes: invalidMarkers });
  await assertRoute({
    path: '/docs/jumentix',
    includes: ['Jumentix Technical Documentation', 'Jumentix Docs'],
    excludes: invalidMarkers
  });
  await assertRoute({
    path: '/docs/overview',
    includes: ['Jumentix Overview', 'Jumentix Docs'],
    excludes: invalidMarkers
  });
  await assertRoute({
    path: '/docs/jumentix/realtime-api-guide',
    includes: ['Creating Realtime API with Jumentix', 'Jumentix Docs'],
    excludes: invalidMarkers
  });
  await assertRoute({
    path: '/docs/realtime-api-guide',
    includes: ['Creating Realtime API with Jumentix', 'Jumentix Docs'],
    excludes: invalidMarkers
  });
  await assertRoute({ path: '/api/version', expectedStatus: 200 });
  await assertRoute({
    path: '/api/github-releases',
    expectedStatus: 403,
    headers: { 'user-agent': 'googlebot' }
  });

  await assertInternalLinks([
    ...englishRoutes.map(([path]) => path),
    ...portugueseRoutes.map(([path]) => path),
  ]);
};

const run = async () => {
  await runCommand(pnpmCommand, ['run', 'typecheck']);
  await runCommand(pnpmCommand, ['run', 'build']);

  const serverProcess = startServer();

  try {
    await waitForServer();
    await smokeRoutes();
  } finally {
    serverProcess.kill('SIGTERM');
    await delay(1500);
    if (!serverProcess.killed) {
      serverProcess.kill('SIGKILL');
    }
  }
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[website prepublish checks] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
