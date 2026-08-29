import { createServer } from 'node:http';
import type { RequestListener, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export async function listenForSupertest(server: Server): Promise<void> {
  if (server.listening) return;

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };

    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });
}

export async function createSupertestServer(listener: RequestListener): Promise<Server> {
  const server = createServer(listener);
  await listenForSupertest(server);
  return server;
}

export function supertestServerUrl(server: Server): string {
  const address = server.address() as AddressInfo | null;
  if (!address || typeof address === 'string') {
    throw new Error('Supertest server must be listening on a TCP port.');
  }
  return `http://127.0.0.1:${String(address.port)}`;
}

export async function closeSupertestServer(server: Server | undefined | null): Promise<void> {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error & { code?: string }) => {
      if (error?.code === 'ERR_SERVER_NOT_RUNNING') {
        resolve();
        return;
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
