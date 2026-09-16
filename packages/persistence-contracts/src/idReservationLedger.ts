export interface IIdReservation {
  entity: string;
  id: string;
  purgedAt: string;
}

export interface IIdReservationLedger {
  reserve(entry: IIdReservation): void;
  has(entity: string, id: string): boolean;
  get(entity: string, id: string): IIdReservation | undefined;
  list(): IIdReservation[];
}

const keyOf = (entity: string, id: string): string => `${entity}:${id}`;

/** In-process ledger: purged ids stay reserved. dev memory dies on restart. */
export class InMemoryIdReservationLedger implements IIdReservationLedger {
  private readonly rows = new Map<string, IIdReservation>();

  public reserve(entry: IIdReservation): void {
    this.rows.set(keyOf(entry.entity, entry.id), entry);
  }

  public has(entity: string, id: string): boolean {
    return this.rows.has(keyOf(entity, id));
  }

  public get(entity: string, id: string): IIdReservation | undefined {
    return this.rows.get(keyOf(entity, id));
  }

  public list(): IIdReservation[] {
    return [...this.rows.values()];
  }
}
