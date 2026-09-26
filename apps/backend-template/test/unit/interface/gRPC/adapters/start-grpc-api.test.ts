const grpcLoaderAdapterStart = jest.fn().mockResolvedValue(undefined);

jest.mock('@src/interface/gRPC/adapters/grpc/grpc', () => ({
  startGrpcAdapter: grpcLoaderAdapterStart
}));

describe('start-grpc-api loader', () => {
  beforeEach(() => {
    grpcLoaderAdapterStart.mockClear();
  });

  it('starts grpc runtime when realtime protocol is grpc', async () => {
    expect.assertions(2);
    const { default: startGrpcApiAdapter } =
      await import('@src/interface/gRPC/adapters/start-grpc-api');
    const started = await startGrpcApiAdapter({
      JUMENTIX_REALTIME_API: 'yes',
      JUMENTIX_REALTIME_API_PROTOCOL: 'grpc'
    } as unknown as NodeJS.ProcessEnv);
    expect(started).toBe(true);
    expect(grpcLoaderAdapterStart).toHaveBeenCalledTimes(1);
  });

  it('does not start grpc runtime when realtime protocol is websocket', async () => {
    expect.assertions(2);
    const { default: startGrpcApiAdapter } =
      await import('@src/interface/gRPC/adapters/start-grpc-api');
    const started = await startGrpcApiAdapter({
      JUMENTIX_REALTIME_API: 'yes',
      JUMENTIX_REALTIME_API_PROTOCOL: 'websocket'
    } as unknown as NodeJS.ProcessEnv);
    expect(started).toBe(false);
    expect(grpcLoaderAdapterStart).not.toHaveBeenCalled();
  });

  it('uses process env when env argument is omitted', async () => {
    expect.assertions(2);
    process.env.JUMENTIX_REALTIME_API = 'yes';
    process.env.JUMENTIX_REALTIME_API_PROTOCOL = 'grpc';
    const { default: startGrpcApiAdapter } =
      await import('@src/interface/gRPC/adapters/start-grpc-api');
    const started = await startGrpcApiAdapter();
    expect(started).toBe(true);
    expect(grpcLoaderAdapterStart).toHaveBeenCalledTimes(1);
  });
});
