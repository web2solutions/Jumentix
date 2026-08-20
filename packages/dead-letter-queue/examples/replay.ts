/* eslint-disable no-console */
/**
 * JUM-53 — the whole lifecycle in one runnable file.
 *
 *   bun run --filter @jumentix/dead-letter-queue example
 *
 * No Redis and no server: the in-memory store is the same queue with a
 * different place to put records. Edit the handler below and re-run — the
 * point of this file is that the behaviour is yours to poke at.
 */
import { DeadLetterQueue } from '../src';

/** Stands in for the mutex. Flip it to watch the record change status. */
let resourceIsLocked = true;

/** Stands in for the row the write should land in. */
const table = new Map<string, unknown>();

async function main(): Promise<void> {
  const queue = new DeadLetterQueue({ maxAttempts: 3 });

  // 1. The service was refused by the mutex, so it records the attempt and
  //    still throws to its caller. Only the recording half is shown here.
  const record = await queue.enqueue({
    entityName: 'User',
    resourceId: 'user-1',
    operation: 'update',
    payload: { firstName: 'Ada' },
    actorId: 'actor-1'
  });
  console.log('1. enqueued  ', { id: record.id, status: record.status, attempts: record.attempts });

  // 2. The replay handler. Throwing means the write did not happen — including
  //    when the reason is that the lock is still held.
  const handlers = {
    update: async (queued: { resourceId: string; payload: unknown }) => {
      if (resourceIsLocked) throw new Error('User user-1 is locked');
      table.set(queued.resourceId, queued.payload);
    }
  };

  // 3. The lock has not cleared. The record survives, with the attempt counted
  //    and the reason kept.
  console.log('2. drain #1  ', await queue.replay(handlers));
  console.log('   pending   ', (await queue.pending()).map((r) => ({
    attempts: r.attempts, lastError: r.lastError
  })));

  // 4. The lock clears. The write lands, and the assertion that matters is the
  //    row — not that the queue drained.
  resourceIsLocked = false;
  console.log('3. drain #2  ', await queue.replay(handlers));
  console.log('   table     ', Object.fromEntries(table));
  console.log('   pending   ', await queue.pending());

  // 5. A resource whose lock never clears. Bounded, or one stuck write becomes
  //    permanent load.
  const stuck = new DeadLetterQueue({ maxAttempts: 2 });
  await stuck.enqueue({
    entityName: 'User', resourceId: 'user-2', operation: 'update', payload: {}
  });
  const alwaysLocked = { update: async () => { throw new Error('still locked'); } };
  await stuck.replay(alwaysLocked);
  const final = await stuck.replay(alwaysLocked);
  console.log('4. bound     ', final);
  console.log('   nothing pending, and it is never picked again:', await stuck.pending());
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
