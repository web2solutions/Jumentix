import { InMemoryIdReservationLedger } from '@jumentix/persistence-contracts';

/** Shared by User and Organization stores in the dev in-memory client. */
export const entityIdLedger = new InMemoryIdReservationLedger();
