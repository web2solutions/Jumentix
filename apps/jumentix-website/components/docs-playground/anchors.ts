import type { DocsRuntimeId } from './types';

function docsPlaygroundAnchor(runtime: DocsRuntimeId, id: string): string {
  return `playground-${runtime}-${id}`;
}

export default docsPlaygroundAnchor;
