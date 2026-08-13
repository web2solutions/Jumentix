export function trimTrailingBlankCodeLines(source: string): string {
  return source.replace(/(?:[ \t]*\r?\n)+[ \t]*$/u, '');
}
