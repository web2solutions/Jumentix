import { BaseExternalDataRepository } from '../src/BaseExternalDataRepository';
import type { IRepositoryConnectionOptions } from '../src/BaseExternalDataRepository';

/**
 * Requirement 112 — this package owns its suite.
 *
 * Everything here is `protected`, which is why it had none: the helpers are
 * reachable only through a subclass, and every subclass lives in another
 * package. So each concrete repository confirmed the base class incidentally,
 * for the one option shape it happens to use, and the branches nobody's
 * repository takes were never executed at all.
 *
 * A test subclass exposes them directly. That is the point of testing a base
 * class here rather than through its descendants: the contract is what the
 * subclasses may rely on, not what one of them happens to do.
 */

/** Exposes the protected surface, and nothing else. */
class TestRepository extends BaseExternalDataRepository {
  public markConnected(value: boolean): void {
    this.connected = value;
  }

  public required(key: keyof IRepositoryConnectionOptions): string {
    return this.getRequiredOption(key);
  }

  public extra<T>(key: string, fallback: T): T {
    return this.getExtraOption(key, fallback);
  }

  public load(moduleName: string): Promise<unknown> {
    return this.loadModule(moduleName);
  }

  public loadOptional(moduleName: string): Promise<unknown | null> {
    return this.loadOptionalModule(moduleName);
  }

  public async connect(): Promise<void> {
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
  }
}

/*
 * `BaseExternalDataRepository`'s constructor is protected, so a subclass is
 * the only way to build one — which is the same reason its helpers had no
 * suite until now.
 */
const repository = (options: IRepositoryConnectionOptions = {}) => new TestRepository(options);

describe('connection state', () => {
  it('starts disconnected', () => {
    expect.hasAssertions();

    expect(repository().isConnected()).toBe(false);
  });

  it('follows connect and disconnect', async () => {
    expect.hasAssertions();

    const subject = repository();
    await subject.connect();

    expect(subject.isConnected()).toBe(true);

    await subject.disconnect();

    expect(subject.isConnected()).toBe(false);
  });
});

describe('getProviderName', () => {
  it('returns the configured provider', () => {
    expect.hasAssertions();

    expect(repository({ provider: 'dynamodb' }).getProviderName()).toBe('dynamodb');
  });

  /**
   * The fallback is not cosmetic: it lands in the error messages below, and an
   * empty provider would produce `Missing required option "x" for ` — a message
   * that reads like it was truncated.
   */
  it.each([
    ['absent', {}],
    ['empty', { provider: '' }]
  ])('falls back to a named placeholder when the provider is %s', (_label, options) => {
    expect.hasAssertions();

    expect(repository(options).getProviderName()).toBe('unknown-provider');
  });
});

describe('getRequiredOption', () => {
  it('returns the value, trimmed', () => {
    expect.hasAssertions();

    expect(repository({ connectionUrl: '  postgres://host  ' }).required('connectionUrl'))
      .toBe('postgres://host');
  });

  /**
   * Whitespace counts as missing. That is a decision, not an accident: a
   * connection URL of `"   "` fails at connect time with whatever the driver
   * says about a malformed address, which is a much longer walk back to the
   * configuration that caused it.
   */
  it.each([
    ['absent', {}],
    ['empty', { connectionUrl: '' }],
    ['whitespace only', { connectionUrl: '   ' }]
  ])('throws when the option is %s', (_label, options) => {
    expect.hasAssertions();

    expect(() => repository({ provider: 'redis', ...options }).required('connectionUrl'))
      .toThrow('Missing required option "connectionUrl" for redis');
  });
});

describe('getExtraOption', () => {
  it('returns the configured value', () => {
    expect.hasAssertions();

    expect(repository({ extra: { poolSize: 10 } }).extra('poolSize', 1)).toBe(10);
  });

  it.each([
    ['there is no extra block', {}],
    ['the key is absent', { extra: {} }],
    ['the value is undefined', { extra: { poolSize: undefined } }],
    ['the value is null', { extra: { poolSize: null } }]
  ])('falls back when %s', (_label, options) => {
    expect.hasAssertions();

    expect(repository(options).extra('poolSize', 1)).toBe(1);
  });

  /**
   * `0` and `false` are values, not absences. The guard tests for `undefined`
   * and `null` specifically, and a truthiness check here would silently replace
   * a deliberate zero with the fallback.
   */
  it.each([
    ['zero', 0, 99],
    ['false', false, true],
    ['empty string', '', 'fallback']
  ])('keeps a falsy %s rather than falling back', (_label, configured, fallback) => {
    expect.hasAssertions();

    expect(repository({ extra: { value: configured } }).extra('value', fallback))
      .toStrictEqual(configured);
  });
});

describe('loadModule', () => {
  it('returns the module when it resolves', async () => {
    expect.hasAssertions();

    // A module guaranteed present, so this asserts the success path rather than
    // the environment.
    await expect(repository().load('node:path')).resolves.toBeDefined();
  });

  /**
   * The message names the dependency and the provider, because this is the
   * error an operator sees on a fresh deployment: a bare `Cannot find module`
   * says nothing about which optional driver they chose to configure.
   */
  it('explains which optional dependency is missing, and for whom', async () => {
    expect.hasAssertions();

    await expect(repository({ provider: 'cassandra' }).load('no-such-driver-xyz'))
      .rejects.toThrow('Missing optional dependency "no-such-driver-xyz" for cassandra');
  });
});

describe('loadOptionalModule', () => {
  it('returns the module when it resolves', async () => {
    expect.hasAssertions();

    await expect(repository().loadOptional('node:path')).resolves.toBeDefined();
  });

  /** Null rather than a throw: the caller asked whether it is there. */
  it('returns null when the module is absent', async () => {
    expect.hasAssertions();

    await expect(repository().loadOptional('no-such-driver-xyz')).resolves.toBeNull();
  });
});
