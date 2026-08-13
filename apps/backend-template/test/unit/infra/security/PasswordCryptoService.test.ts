import { PasswordCryptoService } from '@src/infra/security/PasswordCryptoService';
import type { IPasswordHasher } from '@src/infra/security/IPasswordCryptoService';

/**
 * The error branches are driven through the injected hasher rather than by
 * replacing the `bcryptjs` module.
 *
 * Module replacement is not portable across the two runners this repository
 * uses: `jest.doMock` and `jest.resetModules` do not exist under `bun test`, and
 * `spyOn` against an ESM namespace works under Bun but Jest rejects it as an
 * assignment to a read-only property. This suite previously used the first pair
 * and so ran only under Jest, while declaring `runner: bun` in the test map
 * (JUM-583).
 *
 * Injecting also makes the assertions say what they mean: the claim is "when the
 * hasher rejects, the promise rejects with it", and that is now literally what
 * is set up. bcryptjs@3 is Promise-based, so the port matches that surface.
 */

/** A hasher whose three methods are set per test. */
const hasherWith = (over: Partial<IPasswordHasher>): IPasswordHasher => ({
  genSalt: async () => 'salt',
  hash: async () => 'hash',
  compare: async () => true,
  ...over
});

describe('password crypto service', () => {
  it('hashes and compares passwords', async () => {
    expect.hasAssertions();
    // The real bcryptjs, through the default parameter — the branch every
    // caller in production takes.
    const service = PasswordCryptoService.compile();
    const { hash, salt } = await service.hash('12345678');

    expect(typeof hash).toBe('string');
    expect(typeof salt).toBe('string');
    await expect(service.compare('12345678', hash)).resolves.toBe(true);
  });

  it('rejects a password that does not match the hash', async () => {
    expect.hasAssertions();
    // The negative half of the previous test. Without it, a `compare` that
    // always returned true would satisfy the suite.
    const service = PasswordCryptoService.compile();
    const { hash } = await service.hash('12345678');

    await expect(service.compare('not-the-password', hash)).resolves.toBe(false);
  });

  it('returns singleton from compile', async () => {
    expect.hasAssertions();
    const first = PasswordCryptoService.compile();
    const second = PasswordCryptoService.compile();

    expect(second).toBe(first);
  });

  it('rejects when the hasher fails to generate a salt', async () => {
    expect.hasAssertions();
    const service = new PasswordCryptoService(hasherWith({
      genSalt: async () => {
        throw new Error('salt-failed');
      }
    }));

    await expect(service.hash('12345678')).rejects.toThrow('salt-failed');
  });

  it('rejects when the hasher fails to hash', async () => {
    expect.hasAssertions();
    const service = new PasswordCryptoService(hasherWith({
      hash: async () => {
        throw new Error('hash-failed');
      }
    }));

    await expect(service.hash('12345678')).rejects.toThrow('hash-failed');
  });

  it('rejects when the hasher fails to compare', async () => {
    expect.hasAssertions();
    const service = new PasswordCryptoService(hasherWith({
      compare: async () => {
        throw new Error('compare-failed');
      }
    }));

    await expect(service.compare('12345678', 'hash')).rejects.toThrow('compare-failed');
  });

  it('resolves the salt and hash the hasher produced', async () => {
    expect.hasAssertions();
    // The success path through the injected seam, so the wrapper is shown to
    // pass values through rather than only to propagate errors.
    const service = new PasswordCryptoService(hasherWith({
      genSalt: async () => 'the-salt',
      hash: async (_password, salt) => `hashed-with-${salt}`
    }));

    await expect(service.hash('12345678')).resolves.toStrictEqual({
      hash: 'hashed-with-the-salt',
      salt: 'the-salt'
    });
  });

  /**
   * A Promise hasher can still resolve `undefined` — no rejection and no value.
   * The earlier code cast the result to `IHash`, so that combination resolved
   * with `undefined`: a stored "password hash" of undefined, reported as a
   * successful registration. These two guards turn it into a rejection at the
   * point it happens, and they are the only paths that tell the two
   * implementations apart, so they are asserted rather than assumed.
   */
  it('rejects when the hasher reports neither a salt nor an error', async () => {
    expect.hasAssertions();

    const service = new PasswordCryptoService(hasherWith({
      genSalt: async () => undefined as unknown as string
    }));

    await expect(service.hash('12345678'))
      .rejects.toThrow('password hasher returned no salt and no error');
  });

  it('rejects when the hasher reports neither a hash nor an error', async () => {
    expect.hasAssertions();

    const service = new PasswordCryptoService(hasherWith({
      hash: async () => undefined as unknown as string
    }));

    await expect(service.hash('12345678'))
      .rejects.toThrow('password hasher returned no hash and no error');
  });
});
