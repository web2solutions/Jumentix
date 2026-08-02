import type { Socket } from 'socket.io-client';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// Through the package entry point, not the module: that is the surface
// consumers get, and a barrel that forgot a re-export would otherwise pass
// every test in this file.
import { WebSocketApiClient, loadSpecs } from '../src';
import type { IWebSocketApiResponse } from '../src';

/**
 * Requirement 112 — this package owns its suite.
 *
 * Testing this needed a change to the source: `io` was a module import, and
 * replacing a module import is the one substitution that behaves differently
 * under the two runners this repository uses (JUM-583). A `socketFactory`
 * parameter works identically in both and costs the production caller nothing —
 * the default is still `io`.
 *
 * What that buys is the part no consumer covers. The backend's tests speak to a
 * real socket; nothing exercises what this client does when the server never
 * answers, or answers with `ok: false`, or when `connect` is called twice.
 */

/** A socket double that captures the emit and replies on demand. */
function socketDouble(over: Partial<{ connected: boolean }> = {}) {
  const emits: Array<{ event: string; payload: unknown }> = [];
  const timeouts: number[] = [];
  let reply: IWebSocketApiResponse | undefined;
  let disconnected = 0;

  const socket = {
    connected: over.connected ?? false,
    timeout(ms: number) {
      timeouts.push(ms);
      return this;
    },
    emit(event: string, payload: unknown, ack: (response?: IWebSocketApiResponse) => void) {
      emits.push({ event, payload });
      ack(reply);
      return this;
    },
    disconnect() {
      disconnected += 1;
      this.connected = false;
      return this;
    }
  };

  return {
    socket,
    emits,
    timeouts,
    disconnectCount: () => disconnected,
    answerWith: (response: IWebSocketApiResponse | undefined) => { reply = response; }
  };
}

function client(over: ReturnType<typeof socketDouble> = socketDouble()) {
  const created: string[] = [];
  const subject = new WebSocketApiClient('ws://api.test', {
    socketFactory: (url) => {
      created.push(url);
      return over.socket as unknown as Socket;
    }
  });

  return { subject, created, double: over };
}

const ok = (over: Partial<IWebSocketApiResponse> = {}): IWebSocketApiResponse => ({
  ok: true,
  operationId: 'listUsers',
  result: { items: [] },
  ...over
});

describe('loadSpecs', () => {
  it('fails when no canonical spec exists above the module directory', () => {
    expect.hasAssertions();

    // An isolated directory under the OS temp root has no `spec/asyncapi`
    // anywhere above it, so the default walk-up finds nothing.
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-sdk-spec-'));
    expect(() => loadSpecs(undefined, isolated))
      .toThrow(/1\.0\.0\.websocket\.yml/);
  });
});

describe('connect', () => {
  it('creates a socket at the configured url', () => {
    expect.hasAssertions();

    const { subject, created } = client();
    subject.connect();

    expect(created).toStrictEqual(['ws://api.test']);
  });

  /**
   * Calling `connect` twice must not open a second socket. It is easy to do —
   * `request` calls it implicitly — and a second connection means the server
   * sees two clients where the caller believes there is one.
   */
  it('does not reconnect when the socket is already connected', () => {
    expect.hasAssertions();

    const double = socketDouble({ connected: true });
    const { subject, created } = client(double);

    subject.connect();
    subject.connect();

    expect(created).toHaveLength(1);
  });

  /**
   * A spec with no declared host. The fallback is what a developer gets when
   * the AsyncAPI document has not been filled in yet, so it has to be a real
   * address rather than `ws://undefined`.
   */
  it('falls back to a default host when the spec declares none', () => {
    expect.hasAssertions();

    const created: string[] = [];
    const subject = new WebSocketApiClient(undefined, {
      loadSpecs: (() => ({ asyncApiWebSocket: {} })) as never,
      socketFactory: (url) => {
        created.push(url);
        return socketDouble().socket as never;
      }
    });

    subject.connect();

    expect(created).toStrictEqual(['ws://localhost:3001']);
  });
});

describe('the default socket factory', () => {
  /**
   * The one line the doubles cannot reach: `io(url, settings)`.
   *
   * It is worth reaching anyway, because it is where the client and the
   * transport meet — a wrong `path` or a missing `transports` here fails only
   * against a real server, which is the slowest possible place to find out.
   *
   * `socket.io-client` builds the socket synchronously and connects on a later
   * tick, so constructing and immediately disconnecting exercises the wiring
   * without opening anything the test has to wait for.
   */
  it('builds a real socket with the configured path and transport', () => {
    expect.hasAssertions();

    const subject = new WebSocketApiClient('ws://127.0.0.1:59999');

    try {
      subject.connect();

      // Reached through the socket the default factory produced.
      const { socket } = subject as unknown as { socket: Socket };

      expect(socket.io.opts).toMatchObject({
        path: '/ws',
        transports: ['websocket']
      });
    } finally {
      subject.disconnect();
    }
  });
});

describe('disconnect', () => {
  it('closes the socket and forgets it', () => {
    expect.hasAssertions();

    const double = socketDouble();
    const { subject, created } = client(double);

    subject.connect();
    subject.disconnect();
    subject.connect();

    expect(double.disconnectCount()).toBe(1);
    // Forgotten, so the next connect builds a new one rather than reusing a
    // closed socket.
    expect(created).toHaveLength(2);
  });

  it('is safe to call before connecting', () => {
    expect.hasAssertions();

    const double = socketDouble();
    const { subject } = client(double);

    expect(() => subject.disconnect()).not.toThrow();
    expect(double.disconnectCount()).toBe(0);
  });
});

describe('request', () => {
  it('connects implicitly and emits the request', async () => {
    expect.hasAssertions();

    const double = socketDouble();
    double.answerWith(ok());
    const { subject, created } = client(double);

    await subject.request({ operationId: 'listUsers' });

    expect(created).toHaveLength(1);
    expect(double.emits).toStrictEqual([
      { event: 'api:request', payload: { operationId: 'listUsers' } }
    ]);
  });

  it('resolves with the response the server sent', async () => {
    expect.hasAssertions();

    const double = socketDouble();
    const response = ok({ result: { items: [1, 2] } });
    double.answerWith(response);
    const { subject } = client(double);

    await expect(subject.request({ operationId: 'listUsers' })).resolves.toStrictEqual(response);
  });

  /**
   * No answer is a timeout, and it must reject rather than resolve with
   * `undefined` — which would reach the caller as a successful response with no
   * result, and be read as "the server returned nothing".
   */
  it('rejects when the server never answers', async () => {
    expect.hasAssertions();

    const double = socketDouble();
    double.answerWith(undefined);
    const { subject } = client(double);

    await expect(subject.request({ operationId: 'listUsers' }))
      .rejects.toThrow('WebSocket timeout/no response');
  });

  it('rejects with the error the server reported', async () => {
    expect.hasAssertions();

    const double = socketDouble();
    double.answerWith({
      ok: false,
      operationId: 'listUsers',
      error: { name: 'Forbidden', message: 'not your data' }
    });
    const { subject } = client(double);

    await expect(subject.request({ operationId: 'listUsers' })).rejects.toThrow('not your data');
  });

  /** A refusal with no message still has to be an error, not a silent success. */
  it('rejects with a fallback message when the failure carries none', async () => {
    expect.hasAssertions();

    const double = socketDouble();
    double.answerWith({ ok: false, operationId: 'listUsers' });
    const { subject } = client(double);

    await expect(subject.request({ operationId: 'listUsers' }))
      .rejects.toThrow('WebSocket operation failed');
  });

  it('applies a timeout to the emit', async () => {
    expect.hasAssertions();

    const double = socketDouble();
    double.answerWith(ok());
    const { subject } = client(double);

    await subject.request({ operationId: 'listUsers' });

    // Without one the promise never settles when the server goes away, and the
    // caller waits for as long as the process lives.
    expect(double.timeouts).toStrictEqual([30000]);
  });
});
