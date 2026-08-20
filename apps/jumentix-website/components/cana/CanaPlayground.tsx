'use client';

import { DocsPlayground } from '../docs-playground/DocsPlayground';

export type CanaPlaygroundProps = {
  id?: string;
  code?: string;
};

/** Backward-compatible alias for DocsPlayground runtime="cana". */
export function CanaPlayground({ id = 'getting-started', code }: CanaPlaygroundProps) {
  return <DocsPlayground runtime="cana" id={id} code={code} />;
}
