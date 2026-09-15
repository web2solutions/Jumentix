/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { RestAPI } from '@src/interface/HTTP/RestAPI';
import { infraHandlers } from '@src/interface/HTTP/adapters/express/handlers/infraHandlers';
import { InMemoryDbClient } from '@src/infra/persistence/InMemoryDatabase/InMemoryDbClient';

/**
 * Load-time module failures in the resolver (JUM-698's other half, REST side).
 *
 * A missing handler module is expected — the resolver falls back to express.
 * A module that exists and explodes while loading must propagate: swallowing
 * it as "missing" hides a broken deploy behind a fallback that cannot work
 * either.
 *
 * Runner portability, learned the hard way: bun's require unwraps mocked
 * modules marked `__esModule` to the default itself, and flattens away
 * property getters that throw — so the handler doubles throw from a `default`
 * getter (nothing pre-loads those modules, and the first require runs the
 * factory on both runners). For the controller side, the concrete controllers
 * are all re-exported by the Users barrel, which loads them before any getter
 * can fire; the controllers barrel itself is imported by nothing, so its
 * factory can throw at evaluation time — exactly what `require` surfaces for
 * a broken module, on both runners. It throws a bare value on purpose: bun
 * treats an `Error` thrown by the factory body as a failed mock and falls
 * back to the real module, while a non-Error propagates.
 */

jest.mock(
  '@src/modules/Users/interface/restapi/frameworks/express/handlers/login',
  () => ({
    __esModule: true,
    get default(): unknown {
      throw new TypeError('handler module exploded');
    }
  })
);

jest.mock(
  '@src/modules/Users/interface/restapi/frameworks/express/handlers/logout',
  () => ({
    __esModule: true
    // No default export: the module loads, but holds no handler factory, so
    // the resolver moves on to the next framework candidate.
  })
);

jest.mock(
  '@src/modules/Users/interface/restapi/frameworks/express/handlers/register',
  () => ({
    __esModule: true,
    get default(): unknown {
      // eslint-disable-next-line no-throw-literal
      throw 'register handler exploded without an Error';
    }
  })
);

jest.mock(
  '@src/modules/Users/adapters/in/http/controllers/index',
  () => {
    // eslint-disable-next-line no-throw-literal
    throw 'controller module exploded';
  }
);

describe('restAPI resolver load-time failures', () => {
  let cwd: string;
  let tmp: string;

  // A bare fixture spec keeps construction from resolving real Users modules,
  // which the doubles above would break.
  beforeEach(() => {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'restapi-loadfail-'));
    fs.mkdirSync(path.join(tmp, 'spec'));
    fs.writeFileSync(
      path.join(tmp, 'spec', 'empty.yml'),
      'openapi: 3.1.0\ninfo:\n  version: 9.9.9\npaths: {}\n',
      'utf8'
    );
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const bareApi = () => new RestAPI<any>({
    databaseClient: InMemoryDbClient,
    webServer: {
      endPointRegister: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    } as any,
    infraHandlers
  }) as any;

  it('rethrows a load-time failure from a handler module instead of falling back', () => {
    expect.hasAssertions();

    const api = bareApi();

    expect(() => api.getHandlerFactory({
      moduleName: 'Users',
      operationId: 'login',
      endPointConfig: { operationId: 'login' }
    })).toThrow('handler module exploded');
  });

  it('moves past a handler module with no default export and fails when none remains', () => {
    expect.hasAssertions();

    const api = bareApi();

    expect(() => api.getHandlerFactory({
      moduleName: 'Users',
      operationId: 'logout',
      endPointConfig: { operationId: 'logout' }
    })).toThrow('Handler not found for module Users, operation logout, framework express.');
  });

  it('rethrows a load-time failure from a controller module', () => {
    expect.hasAssertions();

    let caught: unknown;
    try {
      (RestAPI as any).getControllerModule('Users', 'index');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe('controller module exploded');
  });

  it('rethrows a load-time non-Error from a handler module instead of falling back', () => {
    expect.hasAssertions();

    const api = bareApi();

    // A thrown value carries no `message`; the missing-module check must not
    // mistake that for an absent module and fall back over a broken deploy.
    let caught: unknown;
    try {
      api.getHandlerFactory({
        moduleName: 'Users',
        operationId: 'register',
        endPointConfig: { operationId: 'register' }
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe('register handler exploded without an Error');
  });
});
