import { getPageMap } from 'nextra/page-map';
import { Layout } from 'nextra-theme-docs';

import { MantineFooter } from '@/components/MantineFooter/MantineFooter';
import { MantineNavBar } from '@/components/MantineNavBar/MantineNavBar';

/**
 * Accessibility notes for Nextra chrome (JUM-396):
 * - darkMode=false: ThemeSwitch Listbox only sets `title`, which Headless UI
 *   does not expose as an accessible name. ColorSchemeControl owns theme.
 * - copyPageButton=false: Copy-page menu Select is icon-only with no title /
 *   aria-label (class x:rounded-none) and fails axe button-name.
 */
const DocsLayout = async ({ children }: { children: React.ReactNode }) => (
  <Layout
    copyPageButton={false}
    darkMode={false}
    docsRepositoryBase="https://github.com/web2solutions/Jumentix/tree/dev/apps/jumentix-website"
    editLink="Edit this page on GitHub"
    footer={<MantineFooter key="jumentix-docs-footer" />}
    navbar={<MantineNavBar key="jumentix-docs-navbar" />}
    navigation={{ next: true, prev: true }}
    pageMap={await getPageMap('/docs')}
    feedback={{
      content: 'Report a documentation issue',
      labels: 'documentation,website'
    }}
    sidebar={{
      autoCollapse: true,
      defaultMenuCollapseLevel: 2,
      defaultOpen: true,
      toggleButton: true
    }}
    toc={{
      backToTop: 'Back to top',
      float: true,
      title: 'On this page'
    }}
  >
    {children}
  </Layout>
);

export default DocsLayout;
