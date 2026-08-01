import { ServiceResponse } from '../src/ServiceResponse';

/**
 * Requirement 112 — this package owns its suite.
 *
 * `ServiceResponse` is the envelope every method here returns, so its
 * assignment rules decide what a caller can distinguish. They are not uniform:
 * `result` is assigned when it is not `undefined`, while `error` and `message`
 * are assigned only when truthy. That asymmetry is deliberate for `result` — a
 * count of `0` is an answer — and it is worth pinning, because making the three
 * consistent in either direction changes what callers see.
 */

describe('service response envelope', () => {
  it('carries result, error and message when all are given', () => {
    expect.hasAssertions();

    const error = new Error('failed');
    const response = new ServiceResponse({ result: 'ok', error, message: 'done' });

    expect(response).toMatchObject({ result: 'ok', error, message: 'done' });
  });

  it('leaves every field undefined when nothing is given', () => {
    expect.hasAssertions();

    expect(new ServiceResponse({})).toMatchObject({
      result: undefined,
      error: undefined,
      message: undefined
    });
  });

  /**
   * The case the asymmetry exists for. `unlock` returns the store's delete
   * count, and a truthiness check would turn "deleted nothing" into "no answer".
   */
  it.each([
    ['zero', 0],
    ['false', false],
    ['an empty string', ''],
    ['null', null]
  ])('keeps a falsy result of %s', (_label, result) => {
    expect.hasAssertions();

    expect(new ServiceResponse({ result }).result).toStrictEqual(result);
  });

  it('treats an undefined result as absent', () => {
    expect.hasAssertions();

    expect(new ServiceResponse({ result: undefined }).result).toBeUndefined();
  });

  /**
   * `error` and `message` do use truthiness, so an empty message is dropped
   * rather than carried. That is the right call — an empty string reads as "a
   * message was set" to anything checking for presence — and it is the opposite
   * rule from `result`, which is why it is asserted rather than assumed.
   */
  it('drops an empty message', () => {
    expect.hasAssertions();

    expect(new ServiceResponse({ message: '' }).message).toBeUndefined();
  });

  it('drops an undefined error', () => {
    expect.hasAssertions();

    expect(new ServiceResponse({ error: undefined }).error).toBeUndefined();
  });

  it('accepts a plain object as the error', () => {
    expect.hasAssertions();

    // The contract allows `Record<string, any>` as well as `Error`: some stores
    // reject with a shape rather than an instance.
    const error = { code: 'ECONNREFUSED', address: '127.0.0.1' };

    expect(new ServiceResponse({ error }).error).toStrictEqual(error);
  });
});
