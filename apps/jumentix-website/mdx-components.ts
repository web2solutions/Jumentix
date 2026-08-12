import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { CanaPlayground } from './components/cana/CanaPlayground';
import { DocsPlayground } from './components/docs-playground/DocsPlayground';

const docsComponents = getDocsMDXComponents();

export const useMDXComponents = (components?: any): any => ({
  ...docsComponents,
  CanaPlayground,
  DocsPlayground,
  ...components
});
