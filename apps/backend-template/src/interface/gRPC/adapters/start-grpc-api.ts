import { startGrpcAdapter } from '@src/interface/gRPC/adapters/grpc/grpc';
import { shouldStartRealtimeApi } from '@src/interface/runtime/RuntimeEnvironment';

async function startGrpcApiAdapter(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!shouldStartRealtimeApi('grpc', env)) return false;
  await startGrpcAdapter();
  return true;
}

export default startGrpcApiAdapter;

/* istanbul ignore if */
if (require.main === module) {
  // The process stays alive on the listening server, so startup is
  // not awaited; failures stay unhandled rejections that exit non-zero.
  startGrpcApiAdapter().catch((error: unknown) => {
    throw error;
  });
}
