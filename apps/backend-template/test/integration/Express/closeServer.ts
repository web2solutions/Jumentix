import type { Server } from 'node:http';

export const closeServer = async (server: Server | undefined | null): Promise<void> => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    server.closeAllConnections?.();
  });
};
