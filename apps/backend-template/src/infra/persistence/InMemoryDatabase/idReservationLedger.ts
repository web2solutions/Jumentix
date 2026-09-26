import { InMemoryIdReservationLedger } from '@jumentix/persistence-contracts';

/** Shared by User and Organization stores in the dev in-memory client. */
const entityIdLedger = new InMemoryIdReservationLedger();

export default entityIdLedger;
