/* eslint-disable no-console */
const { WebSocketServer } = require('ws');

const DEFAULT_INTERVAL_MS = 1000;
const MIN_INTERVAL_MS = 500;
const MAX_INTERVAL_MS = 2000;

function clampInterval(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, Math.round(number)));
}

function parseMessage(raw) {
  try {
    return JSON.parse(String(raw || '{}'));
  } catch (_error) {
    return null;
  }
}

function createPm2WsHub(httpServer, options = {}) {
  const collectMetrics = options.collectMetrics;
  const runAction = options.runAction;
  const isAuthorized = options.isAuthorized || (() => true);
  const pathName = options.pathName || '/api/runtime/pm2-ws';

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== pathName) {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  function send(ws, payload) {
    if (ws.readyState !== 1) return;
    ws.send(JSON.stringify(payload));
  }

  async function pushMetrics(client) {
    try {
      const payload = await collectMetrics({
        environment: client.environment,
        filters: client.filters
      });
      send(client.ws, { type: 'metrics', payload });
    } catch (error) {
      send(client.ws, {
        type: 'error',
        code: error instanceof Error && error.code ? error.code : 'PM2_METRICS_ERROR',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function schedule(client) {
    if (client.timer) clearInterval(client.timer);
    client.timer = setInterval(() => {
      pushMetrics(client);
    }, client.intervalMs);
  }

  wss.on('connection', (ws) => {
    const client = {
      ws,
      environment: 'dev',
      filters: {},
      intervalMs: DEFAULT_INTERVAL_MS,
      timer: null
    };
    clients.add(client);

    ws.on('message', async (raw) => {
      const message = parseMessage(raw);
      if (!message || typeof message.type !== 'string') {
        send(ws, { type: 'error', code: 'INVALID_MESSAGE', details: 'Invalid WebSocket payload.' });
        return;
      }
      if (message.type === 'ping') {
        send(ws, { type: 'pong' });
        return;
      }
      if (message.type === 'subscribe') {
        client.environment = String(message.environment || 'dev');
        client.filters = message.filters && typeof message.filters === 'object' ? message.filters : {};
        client.intervalMs = clampInterval(message.intervalMs);
        schedule(client);
        await pushMetrics(client);
        return;
      }
      if (message.type === 'action') {
        if (!isAuthorized(message.token)) {
          send(ws, {
            type: 'action-result',
            ok: false,
            action: message.action,
            scope: message.scope,
            name: message.name,
            error: 'Unauthorized.'
          });
          return;
        }
        try {
          const result = await runAction({
            action: message.action,
            scope: message.scope,
            name: message.name,
            pmId: message.pmId,
            namespace: message.namespace,
            environment: client.environment
          });
          send(ws, {
            type: 'action-result',
            ok: true,
            action: message.action,
            scope: message.scope,
            name: message.name,
            ...(result && typeof result === 'object' ? { result } : {})
          });
          await pushMetrics(client);
        } catch (error) {
          send(ws, {
            type: 'action-result',
            ok: false,
            action: message.action,
            scope: message.scope,
            name: message.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    });

    ws.on('close', () => {
      if (client.timer) clearInterval(client.timer);
      clients.delete(client);
    });
  });

  return {
    wss,
    clients,
    close() {
      for (const client of clients) {
        if (client.timer) clearInterval(client.timer);
        try { client.ws.close(); } catch (_error) { /* ignore */ }
      }
      clients.clear();
      wss.close();
    }
  };
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
  clampInterval,
  createPm2WsHub
};
