'use client';

import { DocsPlayground } from '../docs-playground/DocsPlayground';

export interface CanaPlaygroundProps {
  id?: string;
  code?: string;
}

/** Backward-compatible alias for DocsPlayground runtime="cana". */
export const CanaPlayground = ({ id = 'getting-started', code }: CanaPlaygroundProps) => (
  <DocsPlayground code={code} id={id} runtime="cana" />
);
