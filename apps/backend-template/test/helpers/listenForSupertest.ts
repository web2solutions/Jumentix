import type { Server } from 'node:http';

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
