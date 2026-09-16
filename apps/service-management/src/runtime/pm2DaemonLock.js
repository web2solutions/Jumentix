/**
 * pm2DaemonLock — serializes PM2 daemon access (JUM-770).
 *
 * `require('pm2')` is a process-wide singleton: every `pm2.connect()` shares
 * the same RPC client and `pm2.disconnect()` closes it for everyone. With
 * per-call connect/disconnect (readPm2ProcessList, runPm2Method), a periodic
 * metrics push overlapping a lifecycle action meant one call's disconnect
 * killed the other's in-flight RPC — the callback never fired and the action
 * hung forever. This mutex funnels every daemon critical section through a
 * single promise chain, so a disconnect can only happen when no other RPC is
 * in flight.
 */

let queue = Promise.resolve();

function withPm2DaemonLock(fn) {
  const run = queue.then(fn, fn);
  // The chain itself never rejects — a failed section must not block the next.
  queue = run.catch(() => {});
  return run;
}

module.exports = { withPm2DaemonLock };
