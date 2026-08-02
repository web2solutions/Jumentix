import type { CanaResponseEnvelope } from '../src';
import { createRouter, isCanaErrorCode } from '../src';
import { rejection } from './harness';

/**
 * A fake port rather than a real Worker: the behaviour under test is the
 * correlation and timeout logic, and a real worker would add process teardown
 * timing without testing anything extra. The one thing a real worker would add —
 * that payloads must survive structured clone — is covered by making the fake
 * throw on unclonable input, which is what a real port does.
 */
function fakePort() {
  const listeners: ((event: { data: unknown }) => void)[] = [];
  const sent: Record<string, unknown>[] = [];
  let rejectUnclonable = false;

  return {
    sent,
    failOnUnclonable() { rejectUnclonable = true; },
    /** Answer a request as a worker would. */
    reply(requestId: string, response: Partial<CanaResponseEnvelope>) {
      const message = { requestId, ok: true, ...response };
      listeners.forEach((listener) => listener({ data: message }));
    },
    broadcast(event: unknown) {
      listeners.forEach((listener) => listener({ data: { kind: 'change', event } }));
    },
    port: {
      postMessage(message: unknown) {
        if (rejectUnclonable && typeof (message as { payload?: unknown }).payload === 'function') {
          throw new Error('could not be cloned');
        }
        sent.push(message as Record<string, unknown>);
      },
      addEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
        listeners.push(listener);
      },
      removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
        const at = listeners.indexOf(listener);
        if (at >= 0) listeners.splice(at, 1);
      }
    }
  };
}

describe('cana router correlation', () => {
  it('pairs responses by id, not by arrival order', async () => {
    // The bug this prevents looks like data corruption rather than a messaging
    // fault: a slow request returns another request's rows.
    const harness = fakePort();
    const router = createRouter({ port: harness.port });

    const first = router.send({ kind: 'get', store: 'a' });
    const second = router.send({ kind: 'get', store: 'b' });

    const firstId = harness.sent[0].requestId as string;
    const secondId = harness.sent[1].requestId as string;

    // Answered out of order, deliberately.
    harness.reply(secondId, { result: 'second' });
    harness.reply(firstId, { result: 'first' });

    expect(await first).to.equal('first');
    expect(await second).to.equal('second');
    router.dispose();
  });

  it('delivers broadcasts to the handler and not to any pending request', async () => {
    const harness = fakePort();
    const seen: unknown[] = [];
    const router = createRouter({ port: harness.port, onBroadcast: (event) => seen.push(event) });

    const pending = router.send({ kind: 'get', store: 'a' });
    harness.broadcast({ type: 'created' });
    harness.reply(harness.sent[0].requestId as string, { result: 'row' });

    expect(await pending).to.equal('row');
    expect(seen).to.deep.equal([{ type: 'created' }]);
    router.dispose();
  });

  it('rejects with the typed error the worker reported', async () => {
    const harness = fakePort();
    const router = createRouter({ port: harness.port });

    const pending = router.send({ kind: 'get', store: 'a' });
    harness.reply(harness.sent[0].requestId as string, {
      ok: false,
      error: {
        canaError: true, code: 'NotFound', message: 'no such row', retryable: false
      }
    });

    expect(await rejection(pending)).to.deep.include({ canaError: true, code: 'NotFound' });
    router.dispose();
  });

  it('ignores a response that arrives after its request was abandoned', async () => {
    // A late answer must not become a second, unrelated failure.
    const harness = fakePort();
    const router = createRouter({ port: harness.port });

    const pending = router.send({ kind: 'get', store: 'a' });
    const requestId = harness.sent[0].requestId as string;
    router.abandonAll('worker gone');

    expect(await rejection(pending)).to.deep.include({ canaError: true });
    expect(() => harness.reply(requestId, { result: 'too late' })).not.to.throw();
    router.dispose();
  });
});

describe('cana router failure handling', () => {
  it('reports UnknownOutcome for a write that timed out, not failure', async () => {
    // A write that was sent and never answered may have committed. Calling it a
    // failure invites a retry that duplicates it.
    const harness = fakePort();
    const router = createRouter({ port: harness.port, timeoutMs: 10 });

    const pending = router.send({ kind: 'write', store: 'a' });

    expect(await rejection(pending)).to.deep.include({ code: 'UnknownOutcome' });
    router.dispose();
  });

  it('reports Unavailable for a read that timed out, which is unambiguous', async () => {
    // A read that never answered changed nothing, so there is no ambiguity to
    // preserve — and reporting it as unknown would send callers to the ledger
    // for no reason.
    const harness = fakePort();
    const router = createRouter({ port: harness.port, timeoutMs: 10 });

    const pending = router.send({ kind: 'get', store: 'a' });

    expect(await rejection(pending)).to.deep.include({ code: 'Unavailable' });
    router.dispose();
  });

  it('points a timed-out write at the ledger rather than at a retry', async () => {
    const harness = fakePort();
    const router = createRouter({ port: harness.port, timeoutMs: 10 });

    const failure = await router.send({ kind: 'transaction' }).catch((error: unknown) => error);

    expect((failure as { message: string }).message).to.include('operation ledger');
    router.dispose();
  });

  it('abandons in-flight writes as unknown and reads as unavailable', async () => {
    const harness = fakePort();
    const router = createRouter({ port: harness.port });

    const write = router.send({ kind: 'write', store: 'a' });
    const read = router.send({ kind: 'get', store: 'a' });

    expect(router.pendingCount).to.equal(2);
    router.abandonAll('The worker exited.');

    expect(await rejection(write)).to.deep.include({ code: 'UnknownOutcome' });
    expect(await rejection(read)).to.deep.include({ code: 'Unavailable' });
    expect(router.pendingCount).to.equal(0);
    router.dispose();
  });

  it('fails clearly when a payload cannot cross the boundary', async () => {
    // This one genuinely did not happen — the message never reached the worker —
    // so it is InvalidRequest rather than UnknownOutcome.
    const harness = fakePort();
    harness.failOnUnclonable();
    const router = createRouter({ port: harness.port });

    const failure = await router
      .send({ kind: 'write', store: 'a', payload: () => undefined })
      .catch((error: unknown) => error);

    expect(isCanaErrorCode(failure, 'InvalidRequest')).to.equal(true);
    expect((failure as { message: string }).message).to.include('structured-cloneable');
    router.dispose();
  });

  it('refuses new requests once disposed', async () => {
    const harness = fakePort();
    const router = createRouter({ port: harness.port });
    router.dispose();

    expect(await rejection(router.send({ kind: 'ping' }))).to.deep.include({ code: 'Unavailable' });
  });

  it('stops listening after dispose', () => {
    const harness = fakePort();
    const seen: unknown[] = [];
    const router = createRouter({ port: harness.port, onBroadcast: (event) => seen.push(event) });

    harness.broadcast({ type: 'created' });
    router.dispose();
    harness.broadcast({ type: 'deleted' });

    expect(seen).to.have.lengthOf(1);
  });
});

/*
 * NOT COVERED:
 *
 * A real Worker. These tests exercise correlation and failure handling over a
 * fake port; they do not prove that the engine runs correctly inside a worker,
 * that structured clone accepts every payload the engine produces, or that a
 * genuinely killed worker triggers the timeout path. That needs the worker host
 * itself (JUM-409/410) and a real browser (JUM-417).
 */
