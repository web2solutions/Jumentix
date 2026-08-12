import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { CanaFrameworkPlayground } from './components/cana-framework/CanaFrameworkPlayground';
import { CanaPlayground } from './components/cana/CanaPlayground';
import { MDXMonacoPre } from './components/code/MDXMonacoPre';
import { DocsPlayground } from './components/docs-playground/DocsPlayground';

const docsComponents = getDocsMDXComponents();

export const useMDXComponents = (components?: any): any => ({
  ...docsComponents,
  pre: MDXMonacoPre,
  CanaFrameworkPlayground,
  CanaPlayground,
  DocsPlayground,
  ...components
});
