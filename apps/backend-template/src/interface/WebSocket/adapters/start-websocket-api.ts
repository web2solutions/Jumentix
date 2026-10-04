import cluster from 'node:cluster';

import { shouldStartRealtimeApi } from '@src/interface/runtime/RuntimeEnvironment';
import {
  isClusterSocketIoEnabled,
  resolveWebSocketClusterWorkers,
  setupSocketIoClusterPrimary
} from '@src/interface/WebSocket/adapters/socket-io/clusterAdapter';
import { startWebSocketAdapter } from '@src/interface/WebSocket/adapters/socket-io/socket-io';

export default async function startWebSocketApiAdapter(
  env: NodeJS.ProcessEnv = process.env
): Promise<boolean> {
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

/* istanbul ignore if */
if (require.main === module) {
  startWebSocketApiAdapter().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  });
}
