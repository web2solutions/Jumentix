import { MantineFooter } from '@/components/MantineFooter/MantineFooter';
import { MantineNavBar } from '@/components/MantineNavBar/MantineNavBar';
import { getPageMap } from 'nextra/page-map';
import { Layout } from 'nextra-theme-docs';

/**
 * Accessibility notes for Nextra chrome (JUM-396):
 * - darkMode=false: ThemeSwitch Listbox only sets `title`, which Headless UI
 *   does not expose as an accessible name. ColorSchemeControl owns theme.
 * - copyPageButton=false: Copy-page menu Select is icon-only with no title /
 *   aria-label (class x:rounded-none) and fails axe button-name.
 */
export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout
      navbar={<MantineNavBar key="jumentix-docs-navbar" />}
      pageMap={await getPageMap('/docs')}
      docsRepositoryBase="https://github.com/web2solutions/Jumentix/tree/dev/apps/jumentix-website"
      editLink="Edit this page on GitHub"
      feedback={{
        content: 'Report a documentation issue',
        labels: 'documentation,website'
      }}
      navigation={{ next: true, prev: true }}
      footer={<MantineFooter key="jumentix-docs-footer" />}
      darkMode={false}
      copyPageButton={false}
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
}
