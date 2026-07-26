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
  IconSearch,
  IconTopologyStar3,
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
}: {
  current: number;
  total: number;
  onChange?: (page: number) => void;
}) {
  const pages = Array.from({ length: total }, (_, index) => index + 1);
  return (
    <nav className={classes.pagination} aria-label="Pagination">
      <button
        className={classes.pageButton}
        type="button"
        disabled={current <= 1}
        aria-label="Previous page"
        onClick={() => onChange?.(current - 1)}
      >
        <IconArrowLeft size={17} />
      </button>
      {pages.map((page) => (
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
      ))}
      <button
        className={classes.pageButton}
        type="button"
        disabled={current >= total}
        aria-label="Next page"
        onClick={() => onChange?.(current + 1)}
      >
        <IconArrowRight size={17} />
      </button>
    </nav>
  );
}

export function LocaleSwitch({ locale = 'EN' }: { locale?: 'EN' | 'PT-BR' }) {
  return (
    <button className={classes.locale} type="button" aria-label={`Current language: ${locale}`}>
      <IconLanguage size={17} aria-hidden="true" />
      {locale}
    </button>
  );
}

const navItems = [
  ['Product', '/product'],
  ['Use cases', '/use-cases'],
  ['Integrations', '/integrations'],
  ['Docs', '/docs/jumentix'],
];

export function SiteHeader() {
  return (
    <header className={classes.header}>
      <div className={classes.headerInner}>
        <BrandMark />
        <nav className={classes.nav} aria-label="Main navigation">
          {navItems.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className={classes.headerActions}>
          <LocaleSwitch />
          <ActionLink href="https://github.com/web2solutions/aaa-typescript-boilerplate" variant="secondary" external>
            GitHub
          </ActionLink>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={classes.footer}>
      <div className={classes.footerInner}>
        <div>
          <BrandMark />
          <p className={classes.footerDescription}>
            An open-source software factory for contract-first, scalable Node.js products.
          </p>
        </div>
        <div className={classes.footerColumn}>
          <strong>Build</strong>
          <a href="/product">Product</a>
          <a href="/use-cases">Use cases</a>
          <a href="/integrations">Integrations</a>
        </div>
        <div className={classes.footerColumn}>
          <strong>Learn</strong>
          <a href="/docs/jumentix">Documentation</a>
          <a href="/architecture">Architecture</a>
          <a href="/changelog">Changelog</a>
        </div>
        <div className={classes.footerColumn}>
          <strong>Community</strong>
          <a href="https://github.com/web2solutions/aaa-typescript-boilerplate">GitHub</a>
          <a href="/security-compliance">Security</a>
          <a href="/contact">Contact</a>
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
