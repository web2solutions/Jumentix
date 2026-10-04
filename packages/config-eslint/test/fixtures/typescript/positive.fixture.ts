// @ts-expect-error — the fixture documents why the suppression exists
export const parsed: number = 'not a number';

export function identity(value: number): number {
  return value;
}
