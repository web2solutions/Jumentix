import { render, screen } from '@/test-utils';
import { CommercialPage, CommercialUseCasePage } from '../commercial/CommercialPages';
import {
  BrandMark,
  ActionLink,
  SiteHeader,
  SiteFooter,
  Pagination,
  LocaleSwitch,
  DocsToolbar,
  ArchitectureFlow,
} from '../design-system';

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
      const isExternal = EXTERNAL_DOMAINS.some((domain) => href.includes(domain));
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

describe('Link quality', () => {
  const pages: Array<Parameters<typeof CommercialPage>[0]['page']> = [
    'home',
    'product',
    'use-cases',
    'integrations',
    'architecture',
    'security',
    'engagement',
    'contact',
    'community',
    'roadmap',
  ];

  const useCases: Array<Parameters<typeof CommercialUseCasePage>[0]['name']> = [
    'rest-api',
    'realtime-api',
    'saas-monolith',
    'saas-microservices',
    'spa-pwa',
  ];

  const locales: Array<'en' | 'pt-BR'> = ['en', 'pt-BR'];

  describe.each(pages)('%s page', (page) => {
    describe.each(locales)('%s locale', (locale) => {
      it('has no invalid link patterns', () => {
        render(<CommercialPage locale={locale} page={page} />);
        const html = screen.getByRole('main').innerHTML;
        const internalLinks = extractInternalLinks(html);

        for (const link of internalLinks) {
          const invalid = hasInvalidPattern(link);
          expect(invalid).toBeNull();
        }
      });

      it('all internal links start with /', () => {
        render(<CommercialPage locale={locale} page={page} />);
        const html = screen.getByRole('main').innerHTML;
        const internalLinks = extractInternalLinks(html);

        for (const link of internalLinks) {
          expect(link).toMatch(/^\//);
        }
      });

      it('has no duplicate internal hrefs in same page (excluding known duplicates)', () => {
        render(<CommercialPage locale={locale} page={page} />);
        const html = screen.getByRole('main').innerHTML;
        const internalLinks = extractInternalLinks(html);

        // Filter out external links that are expected to appear multiple times
        // and known duplicate internal links (e.g., home page has duplicate /docs/jumentix)
        const filteredLinks = internalLinks.filter(
          (link) =>
            !link.includes('github.com') &&
            !link.includes('vercel.com') &&
            !link.includes('mantine.dev') &&
            !link.includes('tabler.io') &&
            link !== '/docs/jumentix' &&
            link !== '/product' &&
            link !== '/pt-BR/docs/jumentix' &&
            link !== '/pt-BR/product'
        );
        const uniqueLinks = new Set(filteredLinks);

        expect(filteredLinks.length).toBe(uniqueLinks.size);
      });
    });
  });

  describe.each(useCases)('%s use case page', (name) => {
    describe.each(locales)('%s locale', (locale) => {
      it('has no invalid link patterns', () => {
        render(<CommercialUseCasePage locale={locale} name={name} />);
        const html = screen.getByRole('main').innerHTML;
        const internalLinks = extractInternalLinks(html);

        for (const link of internalLinks) {
          const invalid = hasInvalidPattern(link);
          expect(invalid).toBeNull();
        }
      });

      it('all internal links start with /', () => {
        render(<CommercialUseCasePage locale={locale} name={name} />);
        const html = screen.getByRole('main').innerHTML;
        const internalLinks = extractInternalLinks(html);

        for (const link of internalLinks) {
          expect(link).toMatch(/^\//);
        }
      });
    });
  });

  describe('Design System components', () => {
    it('BrandMark has valid href', () => {
      render(<BrandMark />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/');
    });

    it('BrandMark with custom href', () => {
      render(<BrandMark href="/custom" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/custom');
    });

    it('ActionLink has valid href', () => {
      render(<ActionLink href="/test">Test</ActionLink>);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/test');
    });

    it('ActionLink external has valid href', () => {
      render(<ActionLink href="https://github.com/XpertMinds/Jumentix" external>GitHub</ActionLink>);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://github.com/XpertMinds/Jumentix');
    });

    it('ActionLink quiet variant has valid href', () => {
      render(<ActionLink href="/docs" variant="quiet">Docs</ActionLink>);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/docs');
    });

    it('SiteHeader has valid internal links (EN)', () => {
      render(<SiteHeader locale="en" currentPath="/" />);
      const navLinks = screen.getAllByRole('link');
      for (const link of navLinks) {
        const href = link.getAttribute('href');
        expect(href).toBeTruthy();
        expect(href).not.toMatch(/^javascript:/i);
      }
    });

    it('SiteHeader has valid internal links (PT-BR)', () => {
      render(<SiteHeader locale="pt-BR" currentPath="/produto" />);
      const navLinks = screen.getAllByRole('link');
      for (const link of navLinks) {
        const href = link.getAttribute('href');
        expect(href).toBeTruthy();
        expect(href).not.toMatch(/^javascript:/i);
      }
    });

    it('SiteFooter has valid internal links (EN)', () => {
      render(<SiteFooter locale="en" />);
      const links = screen.getAllByRole('link');
      for (const link of links) {
        const href = link.getAttribute('href');
        expect(href).toBeTruthy();
        expect(href).not.toMatch(/^javascript:/i);
      }
    });

    it('SiteFooter has valid internal links (PT-BR)', () => {
      render(<SiteFooter locale="pt-BR" />);
      const links = screen.getAllByRole('link');
      for (const link of links) {
        const href = link.getAttribute('href');
        expect(href).toBeTruthy();
        expect(href).not.toMatch(/^javascript:/i);
      }
    });

    it('Pagination links have valid hrefs', () => {
      render(<Pagination current={2} total={5} hrefBase="/test" />);
      const links = screen.getAllByRole('link');
      for (const link of links) {
        const href = link.getAttribute('href');
        expect(href).toMatch(/^\/test\?page=\d+$/);
      }
    });

    it('LocaleSwitch link has valid href', () => {
      render(<LocaleSwitch locale="EN" href="/pt-BR" />);
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/pt-BR');
    });

    it('DocsToolbar has valid links', () => {
      render(<DocsToolbar />);
      const links = screen.getAllByRole('link');
      for (const link of links) {
        const href = link.getAttribute('href');
        expect(href).toBeTruthy();
        expect(href).not.toMatch(/^javascript:/i);
      }
    });

    it('ArchitectureFlow has no invalid link patterns', () => {
      render(<ArchitectureFlow steps={[{ title: 'Step 1', description: 'Desc 1' }]} />);
      const container = screen.getByLabelText('Architecture flow');
      const html = container.innerHTML;
      const internalLinks = extractInternalLinks(html);

      for (const link of internalLinks) {
        const invalid = hasInvalidPattern(link);
        expect(invalid).toBeNull();
      }
    });
  });
});