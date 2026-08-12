/**
 * Wait for a condition, with a bound (JUM-679, Requirement 134 §2).
 *
 * A bounded poll is not a sleep, and the difference is the point:
 *
 *  - it returns as soon as the condition holds, so it does not spend the time
 *    a fixed wait spends even when the work finished immediately;
 *  - it fails with a message naming what never happened, rather than an
 *    assertion failing later for a reason the reader has to reconstruct;
 *  - it does not encode a guess about how fast the machine is, which is the
 *    property a sleep quietly depends on and CI quietly breaks.
 *
 * Use it where the thing being waited for genuinely runs on a real timer — a
 * default scheduler under test, a broker delivering. Where the schedule can be
 * injected, inject it: this is the second-best answer.
 */
export async function until(
  condition: () => boolean | Promise<boolean>,
  {
    timeoutMs = 5000,
    stepMs = 10,
    describe = 'condition'
  }: { timeoutMs?: number; stepMs?: number; describe?: string } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    if (await condition()) return;
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${describe}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, stepMs); });
  }
}
