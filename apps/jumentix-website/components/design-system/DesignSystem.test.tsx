import { render, screen, within, act } from '@/test-utils';
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

describe('Design System components', () => {
  describe('BrandMark', () => {
    it('renders brand link with correct aria-label', () => {
    expect.hasAssertions();
      render(<BrandMark />);
      const link = screen.getByRole('link', { name: 'Jumentix home' });
      expect(link).toHaveAttribute('href', '/');
    });

    it('renders custom href when provided', () => {
    expect.hasAssertions();
      render(<BrandMark href="/custom" />);
      const link = screen.getByRole('link', { name: 'Jumentix home' });
      expect(link).toHaveAttribute('href', '/custom');
    });
  });

  describe('ActionLink', () => {
    it('renders primary variant by default', () => {
    expect.hasAssertions();
      render(<ActionLink href="/test">Test</ActionLink>);
      const link = screen.getByRole('link', { name: 'Test' });
      expect(link).toHaveClass('action');
      expect(link).toHaveClass('primary');
    });

    it('renders secondary variant', () => {
    expect.hasAssertions();
      render(<ActionLink href="/test" variant="secondary">Test</ActionLink>);
      const link = screen.getByRole('link', { name: 'Test' });
      expect(link).toHaveClass('secondary');
    });

    it('adds external attributes when external=true', () => {
    expect.hasAssertions();
      render(<ActionLink href="https://example.com" external>External</ActionLink>);
      const link = screen.getByRole('link', { name: 'External' });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    });

    it('does not add external attributes when external=false', () => {
    expect.hasAssertions();
      render(<ActionLink href="/test" external={false}>Internal</ActionLink>);
      const link = screen.getByRole('link', { name: 'Internal' });
      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    });
  });

  describe('StatusBadge', () => {
    it('renders with neutral tone by default', () => {
    expect.hasAssertions();
      render(<StatusBadge>Neutral</StatusBadge>);
      const badge = screen.getByText('Neutral');
      expect(badge).toHaveAttribute('data-tone', 'neutral');
    });

    it('renders success tone with check icon', () => {
    expect.hasAssertions();
      render(<StatusBadge tone="success">Success</StatusBadge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveAttribute('data-tone', 'success');
      expect(screen.getByTestId('status-badge-icon')).toBeInTheDocument();
    });

    it('renders attention tone', () => {
    expect.hasAssertions();
      render(<StatusBadge tone="attention">Attention</StatusBadge>);
      expect(screen.getByText('Attention')).toHaveAttribute('data-tone', 'attention');
    });
  });

  describe('SectionHeading', () => {
    it('renders eyebrow, title, and description', () => {
    expect.hasAssertions();
      render(<SectionHeading eyebrow="Eyebrow" title="Title" description="Description" />);
      expect(screen.getByText('Eyebrow')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title');
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('renders without description when not provided', () => {
    expect.hasAssertions();
      render(<SectionHeading eyebrow="Eyebrow" title="Title" />);
      expect(screen.getByText('Eyebrow')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Title');
      expect(screen.queryByText('Description')).not.toBeInTheDocument();
    });
  });

  describe('FeatureGrid', () => {
    it('renders features with title, description, and icon', () => {
    expect.hasAssertions();
      const features = [
        { title: 'Feature 1', description: 'Desc 1', icon: 'Icon1' },
        { title: 'Feature 2', description: 'Desc 2' },
      ];
      render(<FeatureGrid features={features} />);
      expect(screen.getByText('Feature 1')).toBeInTheDocument();
      expect(screen.getByText('Desc 1')).toBeInTheDocument();
      expect(screen.getByText('Feature 2')).toBeInTheDocument();
      expect(screen.getByText('Desc 2')).toBeInTheDocument();
    });

    it('renders default code icon when icon not provided', () => {
    expect.hasAssertions();
      render(<FeatureGrid features={[{ title: 'F', description: 'D' }]} />);
      expect(screen.getByText('F')).toBeInTheDocument();
    });
  });

  describe('Callout', () => {
    it('renders info tone by default with book icon', () => {
    expect.hasAssertions();
      render(<Callout title="Info">Content</Callout>);
      expect(screen.getByText('Info')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByTestId('callout-icon')).toBeInTheDocument();
    });

    it('renders success tone with check icon', () => {
    expect.hasAssertions();
      render(<Callout title="Success" tone="success">Content</Callout>);
      expect(screen.getByTestId('callout-icon')).toBeInTheDocument();
    });

    it('renders warning tone with alert icon', () => {
    expect.hasAssertions();
      render(<Callout title="Warning" tone="warning">Content</Callout>);
      expect(screen.getByTestId('callout-icon')).toBeInTheDocument();
    });
  });

  describe('MetricStrip', () => {
    it('renders metrics with value and label', () => {
    expect.hasAssertions();
      render(<MetricStrip metrics={[{ value: '100', label: 'Percent' }]} />);
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('Percent')).toBeInTheDocument();
    });
  });

  describe('CapabilityTable', () => {
    it('renders table with capability, implementation, and status', () => {
    expect.hasAssertions();
      render(<CapabilityTable rows={[{ capability: 'Cap', implementation: 'Impl', status: 'Done' }]} />);
      expect(screen.getByText('Cap')).toBeInTheDocument();
      expect(screen.getByText('Impl')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('renders status badge with success tone', () => {
    expect.hasAssertions();
      render(<CapabilityTable rows={[{ capability: 'C', implementation: 'I', status: 'Done' }]} />);
      expect(screen.getByText('Done')).toHaveAttribute('data-tone', 'success');
    });
  });

  describe('CodeShowcase', () => {
    const samples = [
      { label: 'Sample 1', language: 'typescript', code: 'const x = 1;' },
      { label: 'Sample 2', language: 'yaml', code: 'key: value' },
    ];

    it('renders first sample by default', () => {
    expect.hasAssertions();
      render(<CodeShowcase samples={samples} />);
      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Sample 1');
    });

    it('switches tabs on click', () => {
    expect.hasAssertions();
      render(<CodeShowcase samples={samples} />);
      const tab2 = screen.getByRole('tab', { name: 'Sample 2' });
      act(() => {
        tab2.click();
      });
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Sample 2');
      expect(screen.getByText('key: value')).toBeInTheDocument();
    });

    it('shows copy button with correct aria-label', () => {
    expect.hasAssertions();
      render(<CodeShowcase samples={samples} />);
      const copyBtn = screen.getByRole('button', { name: 'Copy code' });
      expect(copyBtn).toBeInTheDocument();
    });
  });

  describe('SearchField', () => {
    it('renders search input with placeholder', () => {
    expect.hasAssertions();
      render(<SearchField />);
      const input = screen.getByPlaceholderText('Search Jumentix docs');
      expect(input).toBeInTheDocument();
    });

    it('renders custom label and placeholder', () => {
    expect.hasAssertions();
      render(<SearchField label="Custom label" placeholder="Custom placeholder" />);
      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('renders pagination with current page', () => {
    expect.hasAssertions();
      render(<Pagination current={2} total={5} hrefBase="/test" />);
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/test?page=1');
    });

    it('disables previous button on first page', () => {
    expect.hasAssertions();
      render(<Pagination current={1} total={5} />);
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    });

    it('disables next button on last page', () => {
    expect.hasAssertions();
      render(<Pagination current={5} total={5} />);
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });
  });

  describe('LocaleSwitch', () => {
    it('renders button with locale when no href', () => {
    expect.hasAssertions();
      render(<LocaleSwitch locale="EN" />);
      const button = screen.getByRole('button', { name: 'Current language: EN' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('EN');
    });

    it('renders link with href when provided', () => {
    expect.hasAssertions();
      render(<LocaleSwitch locale="PT-BR" href="/pt-BR" />);
      const link = screen.getByRole('link', { name: 'Switch language to PT-BR' });
      expect(link).toHaveAttribute('href', '/pt-BR');
    });
  });

  describe('SiteHeader', () => {
    it('renders brand mark and navigation', () => {
    expect.hasAssertions();
      render(<SiteHeader locale="en" currentPath="/" />);
      expect(screen.getByRole('link', { name: 'Jumentix home' })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    });

    it('marks current page in navigation', () => {
    expect.hasAssertions();
      render(<SiteHeader locale="en" currentPath="/product" />);
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const productLink = within(nav).getByRole('link', { name: 'Product' });
      expect(productLink).toHaveAttribute('aria-current', 'page');
    });

    it('shows locale switch with alternate path', () => {
    expect.hasAssertions();
      render(<SiteHeader locale="en" currentPath="/product" />);
      const localeSwitch = screen.getByRole('link', { name: 'Switch language to PT-BR' });
      expect(localeSwitch).toHaveAttribute('href', '/pt-BR/product');
    });
  });

  describe('SiteFooter', () => {
    it('renders brand mark and footer columns', () => {
    expect.hasAssertions();
      render(<SiteFooter locale="en" />);
      expect(screen.getByRole('link', { name: 'Jumentix home' })).toBeInTheDocument();
      expect(screen.getByText('Build')).toBeInTheDocument();
      expect(screen.getByText('Learn')).toBeInTheDocument();
      expect(screen.getByText('Community')).toBeInTheDocument();
    });

    it('localizes text for pt-BR', () => {
    expect.hasAssertions();
      render(<SiteFooter locale="pt-BR" />);
      expect(screen.getByText('Construa')).toBeInTheDocument();
      expect(screen.getByText('Aprenda')).toBeInTheDocument();
      expect(screen.getByText('Comunidade')).toBeInTheDocument();
    });
  });

  describe('DocsToolbar', () => {
    it('renders search field and action links', () => {
    expect.hasAssertions();
      render(<DocsToolbar />);
      expect(screen.getByPlaceholderText('Search Jumentix docs')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Edit on GitHub' })).toBeInTheDocument();
    });
  });

  describe('ArchitectureFlow', () => {
    it('renders steps with badge, title, and description', () => {
    expect.hasAssertions();
      render(<ArchitectureFlow steps={[{ title: 'Step 1', description: 'Desc 1' }]} />);
      expect(screen.getByText('01')).toBeInTheDocument();
      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Desc 1')).toBeInTheDocument();
    });
  });
});