import Image from 'next/image';

import config from '@/config';
import changelogEntries from '@/content/changelog.json';

import { ActionLink, Pagination, SectionHeading, StatusBadge } from '../design-system';
import classes from './CommercialPages.module.css';

import type { CommercialLocale } from './CommercialPages';

const CHANGES_PER_PAGE = 200;

interface ChangelogEntry {
  sha: string | null;
  date: string;
  author: string;
  message: string;
}

const entries = changelogEntries as ChangelogEntry[];

const clampPage = (value: number) => (Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1);

const loadChanges = (page: number) => {
  const totalPages = Math.max(1, Math.ceil(entries.length / CHANGES_PER_PAGE));
  const currentPage = Math.min(clampPage(page), totalPages);
  const start = (currentPage - 1) * CHANGES_PER_PAGE;
  return {
    changes: entries.slice(start, start + CHANGES_PER_PAGE),
    currentPage,
    totalPages
  };
};

const formatDate = (value: string, locale: CommercialLocale) =>
  new Date(value).toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });

const changeUrl = (change: ChangelogEntry) =>
  change.sha
    ? `https://github.com/${config.gitHub.repo}/commit/${change.sha}`
    : `https://github.com/${config.gitHub.repo}/commits/${config.gitHub.defaultBranch}`;

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const CommercialChangelogPage = ({
  locale = 'en',
  page: requestedPage = '1'
}: {
  locale?: CommercialLocale;
  page?: string;
}) => {
  const portuguese = locale === 'pt-BR';
  const { changes, currentPage, totalPages } = loadChanges(Number(requestedPage));

  const basePath = portuguese ? '/pt-BR/changelog' : '/changelog';
  return (
    <main className={classes.page}>
      <section className={classes.pageHero}>
        <div className={`${classes.container} ${classes.pageHeroGrid}`}>
          <div>
            <StatusBadge tone="success">GitHub</StatusBadge>
            <h1>{portuguese ? 'Changelog do Jumentix' : 'Jumentix changelog'}</h1>
            <p>
              {portuguese
                ? `Histórico verificável da branch ${config.gitHub.defaultBranch}, com até ${CHANGES_PER_PAGE} mudanças por página.`
                : `Verifiable history from the ${config.gitHub.defaultBranch} branch, with up to ${CHANGES_PER_PAGE} changes per page.`}
            </p>
            <div className={classes.sectionActions}>
              <ActionLink
                external
                href={`https://github.com/${config.gitHub.repo}/commits/${config.gitHub.defaultBranch}`}
              >
                {portuguese ? 'Histórico completo' : 'Full GitHub history'}
              </ActionLink>
            </div>
          </div>
          <Image
            alt={portuguese ? 'Mascote Jumentix' : 'Jumentix mascot'}
            className={classes.mascot}
            height={300}
            src="/brand/jumentix-mascot.png"
            width={300}
          />
        </div>
      </section>
      <section className={classes.band}>
        <div className={`${classes.container} ${classes.sectionStack}`}>
          <div className={classes.paginationRow}>
            <SectionHeading
              eyebrow={portuguese ? 'Mudanças publicadas' : 'Published changes'}
              title={
                portuguese
                  ? `Página ${currentPage} de ${totalPages}`
                  : `Page ${currentPage} of ${totalPages}`
              }
            />
            <Pagination
              current={currentPage}
              hrefBase={basePath}
              total={Math.min(totalPages, 12)}
            />
          </div>
          <div className={classes.changelogList}>
            {changes.map((change) => (
              <article
                key={change.sha ?? `${change.date}-${change.message}`}
                className={classes.change}
              >
                <div className={classes.changeHeader}>
                  <h2>{change.message}</h2>
                  {change.sha ? <StatusBadge>{change.sha.slice(0, 8)}</StatusBadge> : null}
                </div>
                <div className={classes.changeMeta}>
                  <span>{formatDate(change.date, locale)}</span>
                  <span>
                    {portuguese ? 'por' : 'by'} {change.author}
                  </span>
                </div>
                <a href={changeUrl(change)} rel="noreferrer" target="_blank">
                  {portuguese ? 'Ver mudança no GitHub' : 'View change on GitHub'}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};
