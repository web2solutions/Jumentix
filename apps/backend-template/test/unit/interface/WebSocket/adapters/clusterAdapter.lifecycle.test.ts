import cluster from 'node:cluster';

import type { Server } from 'socket.io';

const setupPrimaryMock = jest.fn();
const createAdapterMock = jest.fn();

jest.mock('@socket.io/cluster-adapter', () => ({
  setupPrimary: (...args: any[]) => setupPrimaryMock(...args),
  createAdapter: (...args: any[]) => createAdapterMock(...args)
}));

describe('clusterAdapter lifecycle', () => {
  beforeEach(() => {
    setupPrimaryMock.mockReset();
    createAdapterMock.mockReset();
  });

  it('sets up cluster primary process serialization and adapter bridge', async () => {
    expect.hasAssertions();
    const setupPrimarySpy = jest.spyOn(cluster, 'setupPrimary').mockReturnValue(undefined);
    const adapterFn = jest.fn();
    const fakeIo = { adapter: adapterFn } as unknown as Server;
    const fakeAdapter = jest.fn();
    createAdapterMock.mockReturnValue(fakeAdapter);
    const { setupSocketIoClusterPrimary, createClusterSocketIoAdapter } =
      await import('@src/interface/WebSocket/adapters/socket-io/clusterAdapter');

    setupSocketIoClusterPrimary();
    const adapter = createClusterSocketIoAdapter();
    await adapter.configure(fakeIo);
    await adapter.cleanup();

    expect(setupPrimaryMock).toHaveBeenCalledTimes(1);
    expect(setupPrimarySpy).toHaveBeenCalledWith({ serialization: 'advanced' });
    expect(createAdapterMock).toHaveBeenCalledTimes(1);
    expect(adapterFn).toHaveBeenCalledWith(fakeAdapter);
    setupPrimarySpy.mockRestore();
  });
});
