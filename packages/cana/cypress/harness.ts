/**
 * The two things every browser spec in this package needs.
 *
 * Deliberately small. A test harness that grows helpers grows a second
 * implementation of the thing under test, and this one has no business knowing
 * anything about Cana.
 */

/**
 * A database name no other test will use.
 *
 * Real IndexedDB persists across tests and across runs, which a fake rebuilt
 * per test hides completely. Sharing a name between two tests makes the second
 * one depend on the first, in an order nobody declared.
 */
let sequence = 0;
export const uniqueName = (prefix: string): string => {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
};

/**
 * The error a promise rejected with.
 *
 * Chai has no `.rejects`, and the alternative is a plugin. This is four lines
 * and says exactly what it does: it fails the test if the promise resolves,
 * because a test written to assert a rejection has learned nothing when the
 * call succeeds.
 */
export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject, and it resolved.');
}

/**
 * The error a function threw.
 *
 * The companion to `rejection`, and there for the same reason: these suites
 * assert on the `code` an error carries, and Chai's `.to.throw` matches a
 * message or a constructor, not an arbitrary property. Capturing the error and
 * asserting on it directly says what is meant.
 */
export function thrownBy(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to throw, and it returned.');
}
