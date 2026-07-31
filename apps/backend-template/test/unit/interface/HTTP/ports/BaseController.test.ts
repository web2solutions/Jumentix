import { BaseController } from '@src/interface/HTTP/ports/BaseController';

class ControllerUnderTest extends BaseController {}

describe('base controller', () => {
  it('wires dependencies from factory', () => {
    expect.hasAssertions();
    const controller = new ControllerUnderTest({
      authService: {
        authenticate: jest.fn(),
        authorize: jest.fn(),
        throwIfUserHasNoAccessToResource: jest.fn()
      } as any,
      databaseClient: { stores: {} } as any,
      openApiSpecification: { openapi: '3.0.0' },
      passwordCryptoService: { hash: jest.fn(), compare: jest.fn() } as any,
      mutexService: { lock: jest.fn(), unlock: jest.fn() } as any
    });

    expect(controller.authService).toBeDefined();
    expect(controller.databaseClient).toBeDefined();
    expect(controller.passwordCryptoService).toBeDefined();
    expect(controller.mutexService).toBeDefined();
  });

  it('throws infra not implemented errors on invalid dependencies', () => {
    expect.hasAssertions();
    const controller = new ControllerUnderTest({
      authService: {
        authenticate: jest.fn(),
        authorize: jest.fn(),
        throwIfUserHasNoAccessToResource: jest.fn()
      } as any,
      databaseClient: { stores: {} } as any,
      openApiSpecification: {}
    });

    expect(() => { controller.authService = {} as any; }).toThrow('AuthService is not implemented');
    expect(() => { controller.databaseClient = {} as any; }).toThrow('DatabaseClient is not implemented');
    expect(() => { controller.passwordCryptoService = {} as any; }).toThrow('PasswordCryptoService is not implemented');
    expect(() => { controller.mutexService = {} as any; }).toThrow('MutexService is not implemented');
  });

  it('supports optional message mediator wiring and validates contract', () => {
    expect.hasAssertions();
    const controller = new ControllerUnderTest({
      authService: {
        authenticate: jest.fn(),
        authorize: jest.fn(),
        throwIfUserHasNoAccessToResource: jest.fn()
      } as any,
      databaseClient: { stores: {} } as any,
      openApiSpecification: {},
      messageMediator: {
        request: jest.fn(),
        registerHandler: jest.fn()
      } as any
    });

    expect(controller.messageMediator).toBeDefined();
    controller.messageMediator = undefined;
    expect(controller.messageMediator).toBeUndefined();
    expect(() => { controller.messageMediator = { request: jest.fn() } as any; }).toThrow(
      'MessageMediator is not implemented'
    );
  });
});

/**
 * The ports barrel, exercised through the barrel.
 *
 * `ports/index.ts` carries a comment about a bug it already hit: the repo-wide
 * `import type` codemod left type-only names in a value `export { … }` block, so
 * Bun's ESM loader resolved a binding that does not exist and the entire barrel
 * failed to load. Nothing tested the barrel, so the split between `export type`
 * and `export` was upheld only by that comment.
 */
describe('http ports barrel', () => {
  it('exports the two runtime values and nothing type-only', async () => {
    expect.hasAssertions();
    const barrel = await import('@src/interface/HTTP/ports') as Record<string, unknown>;

    // Enums and abstract classes survive to runtime; interfaces and type
    // aliases do not. A type name appearing here means it was moved out of
    // `export type` and the barrel is one loader away from failing.
    expect(typeof barrel.EHTTPFrameworks).toBe('object');
    expect(typeof barrel.HTTPBaseServer).toBe('function');
    expect(Object.keys(barrel).sort()).toStrictEqual(['EHTTPFrameworks', 'HTTPBaseServer']);
  });
});
