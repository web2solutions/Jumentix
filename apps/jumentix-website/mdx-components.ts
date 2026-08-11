import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { CanaPlayground } from './components/cana/CanaPlayground';

const docsComponents = getDocsMDXComponents();

export const useMDXComponents = (components?: any): any => ({
  ...docsComponents,
  CanaPlayground,
  ...components
});
