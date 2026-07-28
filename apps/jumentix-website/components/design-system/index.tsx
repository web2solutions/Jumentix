'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBook2,
  IconBrandGithub,
  IconCheck,
  IconClipboard,
  IconCode,
  IconExternalLink,
  IconLanguage,
  IconMenu2,
  IconSearch,
  IconTopologyStar3,
  IconX,
} from '@tabler/icons-react';
import classes from './DesignSystem.module.css';

export type ActionLinkProps = {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary' | 'quiet';
  external?: boolean;
};

export function BrandMark({ href = '/' }: { href?: string }) {
  return (
    <a className={classes.brand} href={href} aria-label="Jumentix home">
      <span className={classes.brandIcon} aria-hidden="true">
        <IconTopologyStar3 size={22} stroke={2} />
      </span>
      <span>Jumentix</span>
    </a>
  );
}

export function ActionLink({
  children,
  href,
  variant = 'primary',
  external = false,
}: ActionLinkProps) {
  return (
    <a
      className={`${classes.action} ${classes[variant]}`}
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {children}
      {external ? <IconExternalLink size={16} aria-hidden="true" /> : null}
    </a>
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'attention';
}) {
  return (
    <span className={classes.badge} data-tone={tone}>
      {tone === 'success' ? <IconCheck size={14} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className={classes.sectionHeading}>
      <p className={classes.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

export type Feature = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <div className={classes.featureGrid}>
      {features.map((feature) => (
        <article className={classes.featureCard} key={feature.title}>
          <span className={classes.featureIcon} aria-hidden="true">
            {feature.icon ?? <IconCode size={21} />}
          </span>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </article>
      ))}
    </div>
  );
}

export function Callout({
  title,
  children,
  tone = 'info',
}: {
  title: string;
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning';
}) {
  return (
    <aside className={classes.callout} data-tone={tone}>
      {tone === 'warning' ? (
        <IconAlertTriangle size={20} aria-hidden="true" />
      ) : tone === 'success' ? (
        <IconCheck size={20} aria-hidden="true" />
      ) : (
        <IconBook2 size={20} aria-hidden="true" />
      )}
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}

export type Metric = { value: string; label: string };

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className={classes.metrics}>
      {metrics.map((metric) => (
        <div className={classes.metric} key={metric.label}>
          <strong>{metric.value}</strong>
          <span>{metric.label}</span>
        </div>
      ))}
    </div>
  );
}

export type CapabilityRow = {
  capability: string;
  implementation: string;
  status: string;
};

export function CapabilityTable({ rows }: { rows: CapabilityRow[] }) {
  return (
    <div className={classes.tableWrap}>
      <table className={classes.table}>
        <thead>
          <tr>
            <th scope="col">Capability</th>
            <th scope="col">Implementation</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.capability}>
              <td>{row.capability}</td>
              <td>{row.implementation}</td>
              <td>
                <StatusBadge tone="success">{row.status}</StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type CodeSample = { label: string; language: string; code: string };

export function CodeShowcase({
  samples,
  title = 'Implementation example',
}: {
  samples: CodeSample[];
  title?: string;
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const sample = samples[active] ?? samples[0];

  const copy = async () => {
    if (!sample) return;
    await navigator.clipboard?.writeText(sample.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (!sample) return null;

  return (
    <section className={classes.codeWidget} aria-label={title}>
      <div className={classes.codeHeader}>
        <div className={classes.tabs} role="tablist" aria-label="Code samples">
          {samples.map((entry, index) => (
            <button
              className={classes.tab}
              key={entry.label}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-controls="jtx-code-panel"
              onClick={() => setActive(index)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <button
          className={classes.iconButton}
          type="button"
          onClick={copy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <IconCheck size={17} /> : <IconClipboard size={17} />}
        </button>
      </div>
      <pre className={classes.code} id="jtx-code-panel" role="tabpanel">
        <code data-language={sample.language}>{sample.code}</code>
      </pre>
    </section>
  );
}

export function SearchField({
  label = 'Search documentation',
  placeholder = 'Search Jumentix docs',
}: {
  label?: string;
  placeholder?: string;
}) {
  return (
    <label className={classes.searchWrap}>
      <span hidden>{label}</span>
      <IconSearch className={classes.searchIcon} size={18} aria-hidden="true" />
      <input className={classes.search} type="search" placeholder={placeholder} />
      <kbd className={classes.shortcut} aria-hidden="true">
        /
      </kbd>
    </label>
  );
}

export function Pagination({
  current,
  total,
  onChange,
  hrefBase,
}: {
  current: number;
  total: number;
  onChange?: (page: number) => void;
  hrefBase?: string;
}) {
  const pages = Array.from({ length: total }, (_, index) => index + 1);
  const hrefForPage = (page: number) => `${hrefBase}?page=${page}`;
  const control = (page: number, label: string, children: ReactNode, disabled = false) => {
    if (hrefBase && !disabled) {
      return (
        <a className={classes.pageButton} href={hrefForPage(page)} aria-label={label}>
          {children}
        </a>
      );
    }
    return (
      <button
        className={classes.pageButton}
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={() => onChange?.(page)}
      >
        {children}
      </button>
    );
  };
  return (
    <nav className={classes.pagination} aria-label="Pagination">
      {control(current - 1, 'Previous page', <IconArrowLeft size={17} />, current <= 1)}
      {pages.map((page) => (
        hrefBase ? (
          <a
            className={classes.pageButton}
            href={hrefForPage(page)}
            key={page}
            aria-current={page === current ? 'page' : undefined}
            aria-label={`Page ${page}`}
          >
            {page}
          </a>
        ) : (
          <button
            className={classes.pageButton}
            type="button"
            key={page}
            aria-current={page === current ? 'page' : undefined}
            aria-label={`Page ${page}`}
            onClick={() => onChange?.(page)}
          >
            {page}
          </button>
        )
      ))}
      {control(current + 1, 'Next page', <IconArrowRight size={17} />, current >= total)}
    </nav>
  );
}

export function LocaleSwitch({
  locale = 'EN',
  href,
}: {
  locale?: 'EN' | 'PT-BR';
  href?: string;
}) {
  const content = (
    <>
      <IconLanguage size={17} aria-hidden="true" />
      {locale}
    </>
  );

  if (href) {
    return (
      <a className={classes.locale} href={href} aria-label={`Switch language to ${locale}`}>
        {content}
      </a>
    );
  }

  return (
    <button className={classes.locale} type="button" aria-label={`Current language: ${locale}`}>
      {content}
    </button>
  );
}

const navItems = [
  { en: 'Product', pt: 'Produto', href: '/product' },
  { en: 'Use cases', pt: 'Casos de uso', href: '/use-cases' },
  { en: 'Integrations', pt: 'Integrações', href: '/integrations' },
  { en: 'Architecture', pt: 'Arquitetura', href: '/architecture' },
  { en: 'Docs', pt: 'Docs', href: '/docs/jumentix' },
];

const localizePath = (path: string, locale: 'en' | 'pt-BR') => {
  if (path.startsWith('/docs')) return path;
  return locale === 'pt-BR' ? `/pt-BR${path === '/' ? '' : path}` : path;
};

export function SiteHeader({
  locale = 'en',
  currentPath = '/',
}: {
  locale?: 'en' | 'pt-BR';
  currentPath?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPortuguese = locale === 'pt-BR';
  const alternatePath = isPortuguese
    ? currentPath.replace(/^\/pt-BR(?=\/|$)/, '') || '/'
    : `/pt-BR${currentPath === '/' ? '' : currentPath}`;

  return (
    <header className={classes.header}>
      <div className={classes.headerInner}>
        <BrandMark href={localizePath('/', locale)} />
        <nav className={classes.nav} aria-label="Main navigation">
          {navItems.map((item) => (
            <a
              href={localizePath(item.href, locale)}
              key={item.href}
              aria-current={currentPath.endsWith(item.href) ? 'page' : undefined}
            >
              {isPortuguese ? item.pt : item.en}
            </a>
          ))}
        </nav>
        <div className={classes.headerActions}>
          <LocaleSwitch locale={isPortuguese ? 'EN' : 'PT-BR'} href={alternatePath} />
          <ActionLink href="https://github.com/web2solutions/aaa-typescript-boilerplate" variant="secondary" external>
            GitHub
          </ActionLink>
          <button
            className={classes.mobileMenuButton}
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="jtx-mobile-navigation"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
          </button>
        </div>
      </div>
      <nav
        className={classes.mobileNav}
        id="jtx-mobile-navigation"
        aria-label="Mobile navigation"
        hidden={!menuOpen}
      >
        {navItems.map((item) => (
          <a href={localizePath(item.href, locale)} key={item.href}>
            {isPortuguese ? item.pt : item.en}
          </a>
        ))}
        <a href={localizePath('/community', locale)}>
          {isPortuguese ? 'Comunidade' : 'Community'}
        </a>
        <a href={localizePath('/roadmap', locale)}>Roadmap</a>
      </nav>
    </header>
  );
}

export function SiteFooter({ locale = 'en' }: { locale?: 'en' | 'pt-BR' }) {
  const isPortuguese = locale === 'pt-BR';
  return (
    <footer className={classes.footer}>
      <div className={classes.footerInner}>
        <div>
          <BrandMark href={localizePath('/', locale)} />
          <p className={classes.footerDescription}>
            {isPortuguese
              ? 'Uma fábrica de software open source para produtos Node.js escaláveis e orientados a contratos.'
              : 'An open-source software factory for contract-first, scalable Node.js products.'}
          </p>
        </div>
        <div className={classes.footerColumn}>
          <strong>{isPortuguese ? 'Construa' : 'Build'}</strong>
          <a href={localizePath('/product', locale)}>{isPortuguese ? 'Produto' : 'Product'}</a>
          <a href={localizePath('/use-cases', locale)}>{isPortuguese ? 'Casos de uso' : 'Use cases'}</a>
          <a href={localizePath('/integrations', locale)}>{isPortuguese ? 'Integrações' : 'Integrations'}</a>
        </div>
        <div className={classes.footerColumn}>
          <strong>{isPortuguese ? 'Aprenda' : 'Learn'}</strong>
          <a href="/docs/jumentix">Documentation</a>
          <a href={localizePath('/architecture', locale)}>{isPortuguese ? 'Arquitetura' : 'Architecture'}</a>
          <a href={localizePath('/changelog', locale)}>Changelog</a>
        </div>
        <div className={classes.footerColumn}>
          <strong>{isPortuguese ? 'Comunidade' : 'Community'}</strong>
          <a href="https://github.com/web2solutions/aaa-typescript-boilerplate">GitHub</a>
          <a href={localizePath('/roadmap', locale)}>Roadmap</a>
          <a href={localizePath('/community', locale)}>{isPortuguese ? 'Contribua' : 'Contribute'}</a>
          <a href={localizePath('/security-compliance', locale)}>{isPortuguese ? 'Segurança' : 'Security'}</a>
        </div>
      </div>
    </footer>
  );
}

export function DocsToolbar() {
  return (
    <div className={classes.docsToolbar}>
      <SearchField />
      <div className={classes.headerActions}>
        <ActionLink href="https://github.com/web2solutions/aaa-typescript-boilerplate" variant="quiet" external>
          <IconBrandGithub size={17} aria-hidden="true" />
          Edit on GitHub
        </ActionLink>
        <LocaleSwitch />
      </div>
    </div>
  );
}

export type ArchitectureStep = {
  title: string;
  description: string;
};

export function ArchitectureFlow({ steps }: { steps: ArchitectureStep[] }) {
  return (
    <div className={classes.architecture} aria-label="Architecture flow">
      {steps.map((step, index) => (
        <div className={classes.architectureStep} key={step.title}>
          <StatusBadge>0{index + 1}</StatusBadge>
          <strong>{step.title}</strong>
          <span>{step.description}</span>
        </div>
      ))}
    </div>
  );
}
