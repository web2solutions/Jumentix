import { startGrpcAdapter } from '@src/interface/gRPC/adapters/grpc/grpc';
import { shouldStartRealtimeApi } from '@src/interface/runtime/RuntimeEnvironment';

export default async function startGrpcApiAdapter(
  env: NodeJS.ProcessEnv = process.env
): Promise<boolean> {
  if (!shouldStartRealtimeApi('grpc', env)) return false;
  await startGrpcAdapter();
  return true;
}

/* istanbul ignore if */
if (require.main === module) {
  startGrpcApiAdapter().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  });
}
