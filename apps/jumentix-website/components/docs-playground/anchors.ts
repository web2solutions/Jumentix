import type { DocsRuntimeId } from './types';

export function docsPlaygroundAnchor(runtime: DocsRuntimeId, id: string): string {
  return `playground-${runtime}-${id}`;
}
