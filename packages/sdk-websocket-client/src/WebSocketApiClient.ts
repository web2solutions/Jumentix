import { io, Socket } from 'socket.io-client';
import { loadSpecs } from './spec/loadSpecs';

export interface IWebSocketApiRequest {
  operationId: string;
  version?: string;
  authorization?: string;
  input?: Record<string, any>;
  params?: Record<string, any>;
  queryString?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface IWebSocketApiResponse {
  ok: boolean;
  version?: string;
  operationId: string;
  result?: any;
  error?: {
    name: string;
    message: string;
  };
}

/**
 * How a socket is obtained. Injected so this client can be tested.
 *
 * `io` is a module import, and replacing a module import is the one substitution
 * that does not work the same way under both of this repository's runners:
 * `jest.doMock` does not exist under `bun test`, and `spyOn` against an ESM
 * namespace works under bun while Jest rejects it as a write to a read-only
 * property (Requirement 110, JUM-583). A parameter works identically in both,
 * and it costs the production caller nothing — the default is `io`.
 */
export type SocketFactory = (url: string, options: { path: string; transports: string[] })
=> Socket;

export interface IWebSocketApiClientOptions {
  socketFactory?: SocketFactory;
  /**
   * Injected for the same reason as the factory: the loader reads a file, so
   * the host fallback is otherwise reachable only by editing that file.
   */
  loadSpecs?: typeof loadSpecs;
}

export class WebSocketApiClient {
  private readonly url: string;

  private readonly path: string;

  private readonly createSocket: SocketFactory;

  private socket?: Socket;

  constructor(url?: string, options: IWebSocketApiClientOptions = {}) {
    const { asyncApiWebSocket } = (options.loadSpecs || loadSpecs)();
    const host = asyncApiWebSocket?.servers?.local?.host || 'localhost:3001';
    this.url = url || `ws://${host}`;
    this.path = '/ws';
    this.createSocket = options.socketFactory || ((target, settings) => io(target, settings));
  }

  public connect(): void {
    if (this.socket?.connected) return;
    this.socket = this.createSocket(this.url, {
      path: this.path,
      transports: ['websocket']
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
  }

  public async request(request: IWebSocketApiRequest): Promise<IWebSocketApiResponse> {
    if (!this.socket) {
      this.connect();
    }

    return new Promise((resolve, reject) => {
      this.socket!.timeout(30000).emit('api:request', request, (response: IWebSocketApiResponse) => {
        if (!response) {
          reject(new Error('WebSocket timeout/no response'));
          return;
        }
        if (!response.ok) {
          reject(new Error(response.error?.message || 'WebSocket operation failed'));
          return;
        }
        resolve(response);
      });
    });
  }
}

export default WebSocketApiClient;
