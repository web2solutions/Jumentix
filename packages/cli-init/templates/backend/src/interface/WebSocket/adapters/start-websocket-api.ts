import cluster from 'node:cluster';

import { shouldStartRealtimeApi } from '@src/interface/runtime/RuntimeEnvironment';
import {
  isClusterSocketIoEnabled,
  resolveWebSocketClusterWorkers,
  setupSocketIoClusterPrimary
} from '@src/interface/WebSocket/adapters/socket-io/clusterAdapter';
import { startWebSocketAdapter } from '@src/interface/WebSocket/adapters/socket-io/socket-io';

async function startWebSocketApiAdapter(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!shouldStartRealtimeApi('websocket', env)) return false;
  if (isClusterSocketIoEnabled(env)) {
    if (cluster.isPrimary) {
      setupSocketIoClusterPrimary();
      const totalWorkers = resolveWebSocketClusterWorkers(env);
      for (let i = 0; i < totalWorkers; i += 1) {
        cluster.fork();
      }
      cluster.on('exit', () => {
        cluster.fork();
      });
      return true;
    }
  }
  await startWebSocketAdapter();
  return true;
}

export default startWebSocketApiAdapter;

/* istanbul ignore if */
if (require.main === module) {
  // The process stays alive on the listening server, so startup is
  // not awaited; failures stay unhandled rejections that exit non-zero.
  startWebSocketApiAdapter().catch((error: unknown) => {
    throw error;
  });
}
