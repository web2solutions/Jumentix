'use client';

import { Fragment, useId, useState } from 'react';

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
  IconSearch
} from '@tabler/icons-react';
import Link from 'next/link';

import classes from './DesignSystem.module.css';
import { MonacoCodeBlock } from '../code/MonacoCodeBlock';
import trimTrailingBlankCodeLines from '../code/normalizeCode';

import type { ReactNode } from 'react';

export interface ActionLinkProps {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary' | 'quiet';
  external?: boolean;
}

/**
 * JUM-664 — `asLink={false}` is not cosmetic.
 *
 * Nextra's `Navbar` wraps whatever it is given as `logo` in its own anchor to
 * the home page. An anchor inside an anchor is invalid HTML, and React does not
 * merely warn: hydration of that tree fails, so **every client component below
 * the navbar never mounts**. That is why no ```mermaid diagram has ever
 * rendered on this site — the component that draws them is one of those.
 *
 * The marketing header renders its own link, so it keeps the anchor.
 */
export const BrandMark = ({ href = '/', asLink = true }: { href?: string; asLink?: boolean }) => {
  const content = (
    <Fragment>
      <span aria-hidden="true" className={classes.brandIcon}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the raw /brand src is asserted by DesignSystem tests and must stay unoptimized */}
        <img
          alt=""
          data-testid="jumentix-brand-icon"
          height="48"
          src="/brand/jumentix-icon.png"
          width="48"
        />
      </span>
      <span className={classes.brandType}>Jumentix</span>
    </Fragment>
  );

  if (!asLink) {
    return <span className={classes.brand}>{content}</span>;
  }

  return (
    <a aria-label="Jumentix home" className={classes.brand} href={href}>
      {content}
    </a>
  );
};

export const ActionLink = ({
  children,
  href,
  variant = 'primary',
  external = false
}: ActionLinkProps) => (
  <a
    className={`${classes.action} ${classes[variant]}`}
    href={href}
    {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
  >
    {children}
    {external ? <IconExternalLink aria-hidden="true" size={16} /> : null}
  </a>
);

export const StatusBadge = ({
  children,
  tone = 'neutral'
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'attention';
}) => (
  <span className={classes.badge} data-tone={tone}>
    {tone === 'success' ? (
      <IconCheck aria-hidden="true" data-testid="status-badge-icon" size={14} />
    ) : null}
    {children}
  </span>
);

export const SectionHeading = ({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) => (
  <header className={classes.sectionHeading}>
    <p className={classes.eyebrow}>{eyebrow}</p>
    <h2>{title}</h2>
    {description ? <p>{description}</p> : null}
  </header>
);

export interface Feature {
  title: string;
  description: string;
  icon?: ReactNode;
}

export const FeatureGrid = ({ features }: { features: Feature[] }) => (
  <div className={classes.featureGrid}>
    {features.map((feature) => (
      <article key={feature.title} className={classes.featureCard}>
        <span aria-hidden="true" className={classes.featureIcon}>
          {feature.icon ?? <IconCode size={21} />}
        </span>
        <h3>{feature.title}</h3>
        <p>{feature.description}</p>
      </article>
    ))}
  </div>
);

export const Callout = ({
  title,
  children,
  tone = 'info'
}: {
  title: string;
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning';
}) => {
  const CalloutIcon = tone === 'warning' ? IconAlertTriangle : IconCheck;
  return (
    <aside className={classes.callout} data-tone={tone}>
      {tone === 'info' ? (
        <IconBook2 aria-hidden="true" data-testid="callout-icon" size={20} />
      ) : (
        <CalloutIcon aria-hidden="true" data-testid="callout-icon" size={20} />
      )}
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
};

export interface Metric {
  value: string;
  label: string;
}

export const MetricStrip = ({ metrics }: { metrics: Metric[] }) => (
  <div className={classes.metrics}>
    {metrics.map((metric) => (
      <div key={metric.label} className={classes.metric}>
        <strong>{metric.value}</strong>
        <span>{metric.label}</span>
      </div>
    ))}
  </div>
);

export interface CapabilityRow {
  capability: string;
  implementation: string;
  status: string;
}

export const CapabilityTable = ({ rows }: { rows: CapabilityRow[] }) => (
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

export interface CodeSample {
  label: string;
  language: string;
  code: string;
}

export const CodeShowcase = ({
  samples,
  title = 'Implementation example'
}: {
  samples: CodeSample[];
  title?: string;
}) => {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const panelId = useId();
  const sample = samples[active] ?? samples[0];
  const sampleCode = sample ? trimTrailingBlankCodeLines(sample.code) : '';

  const copy = async () => {
    if (!sample) return;
    await navigator.clipboard?.writeText(sampleCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (!sample) return null;

  return (
    <section aria-label={title} className={classes.codeWidget}>
      <div className={classes.codeHeader}>
        <div aria-label="Code samples" className={classes.tabs} role="tablist">
          {samples.map((entry, index) => (
            <button
              key={entry.label}
              aria-controls={panelId}
              aria-selected={active === index}
              className={classes.tab}
              onClick={() => setActive(index)}
              role="tab"
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
        <button
          aria-label={copied ? 'Code copied' : 'Copy code'}
          className={classes.iconButton}
          title={copied ? 'Copied' : 'Copy code'}
          type="button"
          onClick={() => {
            copy().catch(() => undefined);
          }}
        >
          {copied ? <IconCheck size={17} /> : <IconClipboard size={17} />}
        </button>
      </div>
      <div id={panelId} role="tabpanel">
        <MonacoCodeBlock
          readOnly
          ariaLabel={`${sample.label} code sample`}
          className={classes.code}
          language={sample.language}
          maxHeight={360}
          minHeight={160}
          value={sampleCode}
        />
      </div>
    </section>
  );
};

export interface JourneyStep {
  label: string;
  title: string;
  description: string;
  output: string;
  tasks: string[];
  code: CodeSample[];
  playground?: ReactNode;
}

export const MvpJourney = ({
  steps,
  ariaLabel = 'Zero to first MVP journey'
}: {
  steps: JourneyStep[];
  ariaLabel?: string;
}) => {
  const [active, setActive] = useState(0);
  const panelId = useId();
  const step = steps[active] ?? steps[0];

  if (!step) return null;

  return (
    <section aria-label={ariaLabel} className={classes.journey}>
      <div aria-label={ariaLabel} className={classes.journeyTabs} role="tablist">
        {steps.map((entry, index) => (
          <button
            key={`${entry.label}-${entry.title}`}
            aria-controls={panelId}
            aria-selected={active === index}
            className={classes.journeyTab}
            onClick={() => setActive(index)}
            role="tab"
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className={classes.journeyPanel} id={panelId} role="tabpanel">
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        <ul className={classes.journeyTasks}>
          {step.tasks.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>
        <p className={classes.journeyMeta}>{step.output}</p>
        {step.playground}
        {step.code.length > 0 ? <CodeShowcase samples={step.code} title={step.title} /> : null}
      </div>
    </section>
  );
};

export const SearchField = ({
  label = 'Search documentation',
  placeholder = 'Search Jumentix docs'
}: {
  label?: string;
  placeholder?: string;
}) => {
  const inputId = useId();
  return (
    <label className={classes.searchWrap} htmlFor={inputId}>
      <span hidden>{label}</span>
      <IconSearch aria-hidden="true" className={classes.searchIcon} size={18} />
      <input className={classes.search} id={inputId} placeholder={placeholder} type="search" />
      <kbd aria-hidden="true" className={classes.shortcut}>
        /
      </kbd>
    </label>
  );
};

export const Pagination = ({
  current,
  total,
  onChange,
  hrefBase
}: {
  current: number;
  total: number;
  onChange?: (page: number) => void;
  hrefBase?: string;
}) => {
  const pages = Array.from({ length: total }, (_, index) => index + 1);
  const hrefForPage = (page: number) => `${hrefBase}?page=${page}`;
  const control = (page: number, label: string, children: ReactNode, disabled = false) => {
    if (hrefBase && !disabled) {
      return (
        <a aria-label={label} className={classes.pageButton} href={hrefForPage(page)}>
          {children}
        </a>
      );
    }
    return (
      <button
        aria-label={label}
        className={classes.pageButton}
        disabled={disabled}
        onClick={() => onChange?.(page)}
        type="button"
      >
        {children}
      </button>
    );
  };
  return (
    <nav aria-label="Pagination" className={classes.pagination}>
      {control(current - 1, 'Previous page', <IconArrowLeft size={17} />, current <= 1)}
      {pages.map((page) =>
        hrefBase ? (
          <a
            key={page}
            aria-current={page === current ? 'page' : undefined}
            aria-label={`Page ${page}`}
            className={classes.pageButton}
            href={hrefForPage(page)}
          >
            {page}
          </a>
        ) : (
          <button
            key={page}
            aria-current={page === current ? 'page' : undefined}
            aria-label={`Page ${page}`}
            className={classes.pageButton}
            onClick={() => onChange?.(page)}
            type="button"
          >
            {page}
          </button>
        )
      )}
      {control(current + 1, 'Next page', <IconArrowRight size={17} />, current >= total)}
    </nav>
  );
};

export const LocaleSwitch = ({
  locale = 'EN',
  href
}: {
  locale?: 'EN' | 'PT-BR';
  href?: string;
}) => {
  const content = (
    <Fragment>
      <IconLanguage aria-hidden="true" size={17} />
      {locale}
    </Fragment>
  );

  if (href) {
    return (
      <a aria-label={`Switch language to ${locale}`} className={classes.locale} href={href}>
        {content}
      </a>
    );
  }

  return (
    <button aria-label={`Current language: ${locale}`} className={classes.locale} type="button">
      {content}
    </button>
  );
};

const navItems = [
  { en: 'Product', pt: 'Produto', href: '/product' },
  { en: 'Use cases', pt: 'Casos de uso', href: '/use-cases' },
  { en: 'Integrations', pt: 'Integrações', href: '/integrations' },
  { en: 'Architecture', pt: 'Arquitetura', href: '/architecture' },
  { en: 'Docs', pt: 'Docs', href: '/docs/jumentix' }
];

const localizePath = (path: string, locale: 'en' | 'pt-BR') => {
  if (path.startsWith('/docs')) return path;
  return locale === 'pt-BR' ? `/pt-BR${path === '/' ? '' : path}` : path;
};

export const SiteHeader = ({
  locale = 'en',
  currentPath = '/'
}: {
  locale?: 'en' | 'pt-BR';
  currentPath?: string;
}) => {
  const isPortuguese = locale === 'pt-BR';
  const alternatePath = isPortuguese
    ? currentPath.replace(/^\/pt-BR(?=\/|$)/, '') || '/'
    : `/pt-BR${currentPath === '/' ? '' : currentPath}`;

  return (
    <header className={classes.header}>
      <div className={classes.headerInner}>
        <BrandMark href={localizePath('/', locale)} />
        <nav aria-label="Main navigation" className={classes.nav}>
          {navItems.map((item) => (
            <a
              key={item.href}
              aria-current={currentPath.endsWith(item.href) ? 'page' : undefined}
              href={localizePath(item.href, locale)}
            >
              {isPortuguese ? item.pt : item.en}
            </a>
          ))}
        </nav>
        <div className={classes.headerActions}>
          <LocaleSwitch href={alternatePath} locale={isPortuguese ? 'EN' : 'PT-BR'} />
          <ActionLink external href="https://github.com/web2solutions/Jumentix" variant="secondary">
            GitHub
          </ActionLink>
          {/*
            Native <details> keeps the mobile menu free of useState so the
            SSR tree and the hydrated client tree stay identical (React #418).
          */}
          <details className={classes.mobileMenu}>
            <summary
              aria-controls="jtx-mobile-navigation"
              aria-label="Open navigation menu"
              className={classes.mobileMenuButton}
            >
              <IconMenu2 size={20} />
            </summary>
            <nav
              aria-label="Mobile navigation"
              className={classes.mobileNav}
              id="jtx-mobile-navigation"
            >
              {navItems.map((item) => (
                <a key={item.href} href={localizePath(item.href, locale)}>
                  {isPortuguese ? item.pt : item.en}
                </a>
              ))}
              <a href={localizePath('/community', locale)}>
                {isPortuguese ? 'Comunidade' : 'Community'}
              </a>
              <a href={localizePath('/roadmap', locale)}>Roadmap</a>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
};

export const SiteFooter = ({ locale = 'en' }: { locale?: 'en' | 'pt-BR' }) => {
  const isPortuguese = locale === 'pt-BR';
  return (
    <footer className={classes.footer}>
      <div className={classes.footerInner}>
        <div>
          <BrandMark href={localizePath('/', locale)} />
          <p className={classes.footerDescription}>
            {isPortuguese
              ? 'A fábrica open source do jegue Jumentix: produtos Node.js escaláveis, orientados a contratos e feitos para carregar trabalho real.'
              : 'The open-source factory behind the Jumentix jegue: scalable, contract-first Node.js products built to carry real work.'}
          </p>
        </div>
        <div className={classes.footerColumn}>
          <strong>{isPortuguese ? 'Construa' : 'Build'}</strong>
          <a href={localizePath('/product', locale)}>{isPortuguese ? 'Produto' : 'Product'}</a>
          <a href={localizePath('/use-cases', locale)}>
            {isPortuguese ? 'Casos de uso' : 'Use cases'}
          </a>
          <a href={localizePath('/integrations', locale)}>
            {isPortuguese ? 'Integrações' : 'Integrations'}
          </a>
        </div>
        <div className={classes.footerColumn}>
          <strong>{isPortuguese ? 'Aprenda' : 'Learn'}</strong>
          <Link href="/docs/jumentix">Documentation</Link>
          <a href={localizePath('/architecture', locale)}>
            {isPortuguese ? 'Arquitetura' : 'Architecture'}
          </a>
          <a href={localizePath('/changelog', locale)}>Changelog</a>
        </div>
        <div className={classes.footerColumn}>
          <strong>{isPortuguese ? 'Comunidade' : 'Community'}</strong>
          <a href="https://github.com/web2solutions/Jumentix">GitHub</a>
          <a href={localizePath('/roadmap', locale)}>Roadmap</a>
          <a href={localizePath('/community', locale)}>
            {isPortuguese ? 'Contribua' : 'Contribute'}
          </a>
          <a href={localizePath('/security-compliance', locale)}>
            {isPortuguese ? 'Segurança' : 'Security'}
          </a>
        </div>
      </div>
    </footer>
  );
};

export const DocsToolbar = () => (
  <div className={classes.docsToolbar}>
    <SearchField />
    <div className={classes.headerActions}>
      <ActionLink external href="https://github.com/web2solutions/Jumentix" variant="quiet">
        <IconBrandGithub aria-hidden="true" size={17} />
        Edit on GitHub
      </ActionLink>
      <LocaleSwitch />
    </div>
  </div>
);

export interface ArchitectureStep {
  title: string;
  description: string;
}

export const ArchitectureFlow = ({ steps }: { steps: ArchitectureStep[] }) => (
  <div aria-label="Architecture flow" className={classes.architecture}>
    {steps.map((step, index) => (
      <div key={step.title} className={classes.architectureStep}>
        <StatusBadge>0{index + 1}</StatusBadge>
        <strong>{step.title}</strong>
        <span>{step.description}</span>
      </div>
    ))}
  </div>
);
