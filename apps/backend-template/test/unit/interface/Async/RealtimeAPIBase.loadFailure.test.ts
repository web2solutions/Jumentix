/* eslint-disable @typescript-eslint/no-explicit-any */

import { RealtimeAPIBase } from '@src/interface/Async/RealtimeAPIBase';

/**
 * Module-resolution failures that are NOT "module not found" (JUM-698's other
 * half).
 *
 * A missing handler or controller module is an expected condition — fall back
 * or answer `undefined`. A module that exists and explodes while loading is a
 * different failure (a syntax error, a bad import), and swallowing it as
 * "missing" would hide a broken deploy behind a silent fallback. These mocks
 * replace real modules this suite never invokes for their declared operation
 * with doubles that fail at load time — once with an `Error`, once with a bare
 * value, since a broken module throws whatever it throws.
 */

jest.mock(
  '@src/modules/Users/interface/websocketapi/frameworks/socket-io/handlers/logout',
  () => {
    throw new TypeError('handler module exploded');
  }
);

jest.mock(
  '@src/modules/Users/interface/websocketapi/frameworks/socket-io/handlers/updateUserPassword',
  () => {
    // eslint-disable-next-line no-throw-literal
    throw 'handler module exploded without an Error';
  }
);

// The concrete controllers are all re-exported by the Users barrel, so a
// factory that throws at load would break every import of the barrel in this
// file — and a getter that throws only on access is flattened away by bun's
// mock interop. The controllers barrel itself is imported by nothing, which
// makes it the one module reachable through the controller template whose
// evaluation can fail honestly on both runners. A thrown value carries no
// `message`; the resolver must still rethrow it rather than read it as
// "module not found".
jest.mock(
  '@src/modules/Users/adapters/in/http/controllers/index',
  () => {
    // eslint-disable-next-line no-throw-literal
    throw 'controller module exploded without an Error';
  }
);

class ProbeAPI extends RealtimeAPIBase {
  public constructor() {
    super({
      databaseClient: {
        connect: jest.fn(),
        disconnect: jest.fn()
      } as any,
      interfaceType: 'websocketapi',
      frameworkName: 'socket-io'
    }, false);
  }
}

describe('realtime api base load-time module failures', () => {
  it('rethrows a load-time Error from a runtime handler module', () => {
    expect.hasAssertions();

    const api = new ProbeAPI();

    expect(() => (api as any).getRuntimeHandlerFactory({
      moduleName: 'Users',
      operationId: 'logout',
      controllerMethod: 'logout',
      controller: {},
      endPointConfig: {}
    })).toThrow('handler module exploded');
  });

  it('rethrows a load-time non-Error from a runtime handler module', () => {
    expect.hasAssertions();

    const api = new ProbeAPI();

    let caught: unknown;
    try {
      (api as any).getRuntimeHandlerFactory({
        moduleName: 'Users',
        operationId: 'updateUserPassword',
        controllerMethod: 'updatePassword',
        controller: {},
        endPointConfig: {}
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe('handler module exploded without an Error');
  });

  it('rethrows a load-time failure from a controller module', () => {
    expect.hasAssertions();

    let caught: unknown;
    try {
      (RealtimeAPIBase as any).getControllerModule('Users', 'index');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe('controller module exploded without an Error');
  });
});
