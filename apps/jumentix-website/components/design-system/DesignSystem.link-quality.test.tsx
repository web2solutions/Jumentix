import { render, screen } from '@/test-utils';
import {
  BrandMark,
  ActionLink,
  SiteHeader,
  SiteFooter,
  Pagination,
  LocaleSwitch,
  DocsToolbar,
  ArchitectureFlow,
} from './index';

const INVALID_LINK_PATTERNS = [
  /href="\s*javascript:/i,
  /href="\s*#\s*"/,
  /href="\s*$/,
];

const EXTERNAL_DOMAINS = ['github.com', 'vercel.com', 'mantine.dev', 'tabler.io'];

function extractInternalLinks(html: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href="([^"]+)"/g;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href) continue;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      const isExternal = EXTERNAL_DOMAINS.some(domain => href.includes(domain));
      if (!isExternal) {
        links.push(href);
      }
    } else if (href.startsWith('/') && !href.startsWith('/_next')) {
      links.push(href);
    }
  }
  return links;
}

function hasInvalidPattern(href: string): string | null {
  for (const pattern of INVALID_LINK_PATTERNS) {
    if (pattern.test(href)) {
      return pattern.source;
    }
  }
  return null;
}

describe('Design System link quality', () => {
  it('BrandMark has valid href', () => {
    expect.hasAssertions();
    render(<BrandMark />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/');
  });

  it('BrandMark with custom href', () => {
    expect.hasAssertions();
    render(<BrandMark href="/custom" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/custom');
  });

  it('ActionLink has valid href', () => {
    expect.hasAssertions();
    render(<ActionLink href="/test">Test</ActionLink>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/test');
  });

  it('ActionLink external has valid href', () => {
    expect.hasAssertions();
    render(<ActionLink href="https://github.com/web2solutions/Jumentix" external>GitHub</ActionLink>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com/web2solutions/Jumentix');
  });

  it('ActionLink quiet variant has valid href', () => {
    expect.hasAssertions();
    render(<ActionLink href="/docs" variant="quiet">Docs</ActionLink>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/docs');
  });

  it('SiteHeader has valid internal links (EN)', () => {
    expect.hasAssertions();
    render(<SiteHeader locale="en" currentPath="/" />);
    const navLinks = screen.getAllByRole('link');
    for (const link of navLinks) {
      const href = link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/^javascript:/i);
    }
  });

  it('SiteHeader has valid internal links (PT-BR)', () => {
    expect.hasAssertions();
    render(<SiteHeader locale="pt-BR" currentPath="/produto" />);
    const navLinks = screen.getAllByRole('link');
    for (const link of navLinks) {
      const href = link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/^javascript:/i);
    }
  });

  it('SiteFooter has valid internal links (EN)', () => {
    expect.hasAssertions();
    render(<SiteFooter locale="en" />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/^javascript:/i);
    }
  });

  it('SiteFooter has valid internal links (PT-BR)', () => {
    expect.hasAssertions();
    render(<SiteFooter locale="pt-BR" />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/^javascript:/i);
    }
  });

  it('Pagination links have valid hrefs', () => {
    expect.hasAssertions();
    render(<Pagination current={2} total={5} hrefBase="/test" />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href).toMatch(/^\/test\?page=\d+$/);
    }
  });

  it('LocaleSwitch link has valid href', () => {
    expect.hasAssertions();
    render(<LocaleSwitch locale="EN" href="/pt-BR" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/pt-BR');
  });

  it('DocsToolbar has valid links', () => {
    expect.hasAssertions();
    render(<DocsToolbar />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const href = link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toMatch(/^javascript:/i);
    }
  });

  it('ArchitectureFlow has no invalid link patterns', () => {
    expect.hasAssertions();
    render(<ArchitectureFlow steps={[{ title: 'Step 1', description: 'Desc 1' }]} />);
    const container = screen.getByLabelText('Architecture flow');
    const html = container.innerHTML;
    const internalLinks = extractInternalLinks(html);

    // JUM-677: asserted as a set, not in a loop. `ArchitectureFlow` rendered
    // with one step has no links at all, so the loop never ran and this test
    // asserted nothing while passing.
    expect(internalLinks.filter((link) => hasInvalidPattern(link) !== null))
      .toStrictEqual([]);
  });
});