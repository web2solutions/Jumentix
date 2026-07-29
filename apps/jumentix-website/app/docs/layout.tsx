import { MantineFooter } from '@/components/MantineFooter/MantineFooter';
import { MantineNavBar } from '@/components/MantineNavBar/MantineNavBar';
import { getPageMap } from 'nextra/page-map';
import { Layout } from 'nextra-theme-docs';

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout
      navbar={<MantineNavBar key="jumentix-docs-navbar" />}
      pageMap={await getPageMap('/docs')}
      docsRepositoryBase="https://github.com/XpertMinds/Jumentix/tree/dev/apps/jumentix-website"
      editLink="Edit this page on GitHub"
      feedback={{
        content: 'Report a documentation issue',
        labels: 'documentation,website'
      }}
      navigation={{ next: true, prev: true }}
      footer={<MantineFooter key="jumentix-docs-footer" />}
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
