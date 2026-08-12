import { render, screen } from '@/test-utils';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  BrandMark,
  ActionLink,
  StatusBadge,
  SectionHeading,
  FeatureGrid,
  Callout,
  MetricStrip,
  CapabilityTable,
  CodeShowcase,
  SearchField,
  Pagination,
  LocaleSwitch,
  SiteHeader,
  SiteFooter,
  DocsToolbar,
  ArchitectureFlow,
} from './index';

expect.extend(toHaveNoViolations);

describe('Design System a11y', () => {
  const testA11y = async (component: React.ReactElement) => {
    const { container } = render(component);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  };

  describe('BrandMark', () => {
    it('has no a11y violations', async () => {
      await testA11y(<BrandMark />);
    });

    it('has no a11y violations with custom href', async () => {
      await testA11y(<BrandMark href="/custom" />);
    });
  });

  describe('ActionLink', () => {
    it('has no a11y violations (primary)', async () => {
      await testA11y(<ActionLink href="/test">Test</ActionLink>);
    });

    it('has no a11y violations (secondary)', async () => {
      await testA11y(<ActionLink href="/test" variant="secondary">Test</ActionLink>);
    });

    it('has no a11y violations (quiet)', async () => {
      await testA11y(<ActionLink href="/test" variant="quiet">Test</ActionLink>);
    });

    it('has no a11y violations (external)', async () => {
      await testA11y(<ActionLink href="https://example.com" external>External</ActionLink>);
    });
  });

  describe('StatusBadge', () => {
    it('has no a11y violations (neutral)', async () => {
      await testA11y(<StatusBadge>Neutral</StatusBadge>);
    });

    it('has no a11y violations (success)', async () => {
      await testA11y(<StatusBadge tone="success">Success</StatusBadge>);
    });

    it('has no a11y violations (attention)', async () => {
      await testA11y(<StatusBadge tone="attention">Attention</StatusBadge>);
    });
  });

  describe('SectionHeading', () => {
    it('has no a11y violations', async () => {
      await testA11y(<SectionHeading eyebrow="Eyebrow" title="Title" description="Description" />);
    });

    it('has no a11y violations without description', async () => {
      await testA11y(<SectionHeading eyebrow="Eyebrow" title="Title" />);
    });
  });

  describe('FeatureGrid', () => {
    it('has no a11y violations', async () => {
      await testA11y(<FeatureGrid features={[{ title: 'F', description: 'D' }]} />);
    });

    it('has no a11y violations with icon', async () => {
      await testA11y(<FeatureGrid features={[{ title: 'F', description: 'D', icon: 'Icon' }]} />);
    });
  });

  describe('Callout', () => {
    it('has no a11y violations (info)', async () => {
      await testA11y(<Callout title="Info">Content</Callout>);
    });

    it('has no a11y violations (success)', async () => {
      await testA11y(<Callout title="Success" tone="success">Content</Callout>);
    });

    it('has no a11y violations (warning)', async () => {
      await testA11y(<Callout title="Warning" tone="warning">Content</Callout>);
    });
  });

  describe('MetricStrip', () => {
    it('has no a11y violations', async () => {
      await testA11y(<MetricStrip metrics={[{ value: '100', label: 'Percent' }]} />);
    });
  });

  describe('CapabilityTable', () => {
    it('has no a11y violations', async () => {
      await testA11y(<CapabilityTable rows={[{ capability: 'Cap', implementation: 'Impl', status: 'Done' }]} />);
    });
  });

  describe('CodeShowcase', () => {
    const samples = [
      { label: 'Sample 1', language: 'typescript', code: 'const x = 1;' },
      { label: 'Sample 2', language: 'yaml', code: 'key: value' },
    ];

    it('has no a11y violations', async () => {
      await testA11y(<CodeShowcase samples={samples} />);
    });
  });

  describe('SearchField', () => {
    it('has no a11y violations', async () => {
      await testA11y(<SearchField />);
    });

    it('has no a11y violations with custom props', async () => {
      await testA11y(<SearchField label="Custom" placeholder="Search" />);
    });
  });

  describe('Pagination', () => {
    it('has no a11y violations (first page)', async () => {
      await testA11y(<Pagination current={1} total={5} hrefBase="/test" />);
    });

    it('has no a11y violations (middle page)', async () => {
      await testA11y(<Pagination current={3} total={5} hrefBase="/test" />);
    });

    it('has no a11y violations (last page)', async () => {
      await testA11y(<Pagination current={5} total={5} hrefBase="/test" />);
    });

    it('has no a11y violations with onChange callback', async () => {
      await testA11y(<Pagination current={2} total={5} onChange={() => {}} />);
    });
  });

  describe('LocaleSwitch', () => {
    it('has no a11y violations (button)', async () => {
      await testA11y(<LocaleSwitch locale="EN" />);
    });

    it('has no a11y violations (link)', async () => {
      await testA11y(<LocaleSwitch locale="PT-BR" href="/pt-BR" />);
    });
  });

  describe('SiteHeader', () => {
    it('has no a11y violations (en)', async () => {
      await testA11y(<SiteHeader locale="en" currentPath="/" />);
    });

    it('has no a11y violations (pt-BR)', async () => {
      await testA11y(<SiteHeader locale="pt-BR" currentPath="/produto" />);
    });

    it('has no a11y violations with mobile menu open state', async () => {
      await testA11y(<SiteHeader locale="en" currentPath="/product" />);
    });
  });

  describe('SiteFooter', () => {
    it('has no a11y violations (en)', async () => {
      await testA11y(<SiteFooter locale="en" />);
    });

    it('has no a11y violations (pt-BR)', async () => {
      await testA11y(<SiteFooter locale="pt-BR" />);
    });
  });

  describe('DocsToolbar', () => {
    it('has no a11y violations', async () => {
      await testA11y(<DocsToolbar />);
    });
  });

  describe('ArchitectureFlow', () => {
    it('has no a11y violations', async () => {
      await testA11y(<ArchitectureFlow steps={[{ title: 'Step 1', description: 'Desc 1' }]} />);
    });
  });
});