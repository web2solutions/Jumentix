/* eslint-disable no-console */
const http = require('http');

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function resolveHttpPort(processEntry, ecosystemApps) {
  const env = processEntry?.pm2_env?.env || processEntry?.env || {};
  const direct = env.JUMENTIX_HTTP_PORT || processEntry?.pm2_env?.JUMENTIX_HTTP_PORT;
  if (direct) return String(direct);
  const name = String(processEntry?.name || '');
  const app = Array.isArray(ecosystemApps)
    ? ecosystemApps.find((entry) => entry.name === name)
    : null;
  if (app?.env?.JUMENTIX_HTTP_PORT) return String(app.env.JUMENTIX_HTTP_PORT);
  return '';
}

function fetchAsyncContextMetrics(port, options = {}) {
  const timeoutMs = toFiniteNumber(options.timeoutMs, 80);
  const token = options.token || '';
  const host = options.host || '127.0.0.1';
  return new Promise((resolve) => {
    const request = http.request({
      host,
      port: Number(port),
      path: '/async-context-metrics',
      method: 'GET',
      timeout: timeoutMs,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
            return;
          } catch (error) {
            resolve({
              error: error instanceof Error ? error.message : String(error),
              code: 'ASYNC_CONTEXT_PARSE_ERROR'
            });
            return;
          }
        }
        const status = response.statusCode || 0;
        if (status === 404) {
          resolve({
            error: 'Route /async-context-metrics missing on this RestAPI — restart the process from a checkout that includes the route (JUM-767+).',
            code: 'ASYNC_CONTEXT_ROUTE_MISSING',
            status
          });
          return;
        }
        resolve({
          error: `HTTP ${status}`,
          code: 'ASYNC_CONTEXT_HTTP_ERROR',
          status
        });
      });
    });
    request.on('timeout', () => {
      request.destroy();
      resolve({ error: 'timeout', code: 'ASYNC_CONTEXT_TIMEOUT' });
    });
    request.on('error', (error) => {
      resolve({
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof Error && error.code ? String(error.code) : 'ASYNC_CONTEXT_FETCH_ERROR'
      });
    });
    request.end();
  });
}

async function attachAsyncContextMetrics(processes, options = {}) {
  const ecosystemApps = options.ecosystemApps || [];
  const token = options.token || process.env.JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN || '';
  const enriched = await Promise.all((processes || []).map(async (processEntry) => {
    const port = resolveHttpPort(processEntry, ecosystemApps);
    if (!port) {
      return { ...processEntry, asyncContext: null };
    }
    const asyncContext = await fetchAsyncContextMetrics(port, {
      timeoutMs: options.timeoutMs,
      token
    });
    return { ...processEntry, asyncContext };
  }));
  const asyncContextActiveSum = enriched.reduce((sum, processEntry) => {
    const active = processEntry?.asyncContext?.active;
    return sum + (Number.isFinite(Number(active)) ? Number(active) : 0);
  }, 0);
  return { processes: enriched, asyncContextActiveSum };
}

module.exports = {
  attachAsyncContextMetrics,
  fetchAsyncContextMetrics,
  resolveHttpPort
};
