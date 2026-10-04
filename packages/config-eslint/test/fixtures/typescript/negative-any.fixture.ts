// @ts-expect-error — fixture documents the suppression
export const anything: any = JSON.parse('{}');

export function read(): unknown {
  return anything;
}
