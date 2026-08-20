import type { DeadLetterRecord, IDeadLetterStore } from './contracts';

/**
 * Process-local store, for tests and single-process runtimes.
 *
 * Insertion order is preserved because replay order matters: two rejected
 * writes to the same resource must be replayed in the order they were
 * attempted, or the later one loses to the earlier one.
 */
export class InMemoryDeadLetterStore implements IDeadLetterStore {
  private readonly records = new Map<string, DeadLetterRecord>();

  public async put(record: DeadLetterRecord): Promise<void> {
    // Copied on the way in and out: a caller holding a reference must not be
    // able to change a stored record without going through `put`.
    this.records.set(record.id, { ...record });
  }

  public async get(id: string): Promise<DeadLetterRecord | undefined> {
    const found = this.records.get(id);
    return found ? { ...found } : undefined;
  }

  public async list(): Promise<DeadLetterRecord[]> {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  public clear(): void {
    this.records.clear();
  }
}
