/** Unwrap a lookup the bundled spec guarantees; throws a readable failure otherwise. */
const must = <T>(value: T | null | undefined, hint: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`expected ${hint} to exist`);
  }
  return value;
};

export default must;
