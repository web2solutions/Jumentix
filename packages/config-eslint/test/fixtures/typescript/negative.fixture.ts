// @ts-expect-error
export const parsed: number = 'not a number';

export function identity(value: number): number {
  return value;
}
