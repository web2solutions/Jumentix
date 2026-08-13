import config from '@/config';
import changelogEntries from '@/content/changelog.json';
import { ActionLink, Pagination, SectionHeading, StatusBadge } from '../design-system';
import type { CommercialLocale } from './CommercialPages';
import classes from './CommercialPages.module.css';

const CHANGES_PER_PAGE = 200;

interface ChangelogEntry {
  sha: string | null;
  date: string;
  author: string;
  message: string;
}

const entries = changelogEntries as ChangelogEntry[];

const clampPage = (value: number) =>
  Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;

const loadChanges = (page: number) => {
  const totalPages = Math.max(1, Math.ceil(entries.length / CHANGES_PER_PAGE));
  const currentPage = Math.min(clampPage(page), totalPages);
  const start = (currentPage - 1) * CHANGES_PER_PAGE;
  return {
    changes: entries.slice(start, start + CHANGES_PER_PAGE),
    currentPage,
    totalPages,
  };
};

const formatDate = (value: string, locale: CommercialLocale) =>
  new Date(value).toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

const changeUrl = (change: ChangelogEntry) =>
  change.sha
    ? `https://github.com/${config.gitHub.repo}/commit/${change.sha}`
    : `https://github.com/${config.gitHub.repo}/commits/${config.gitHub.defaultBranch}`;

export function CommercialChangelogPage({
  locale = 'en',
  page: requestedPage = '1',
}: {
  locale?: CommercialLocale;
  page?: string;
}) {
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
                href={`https://github.com/${config.gitHub.repo}/commits/${config.gitHub.defaultBranch}`}
                external
              >
                {portuguese ? 'Histórico completo' : 'Full GitHub history'}
              </ActionLink>
            </div>
          </div>
          <img
            className={classes.mascot}
            src="/brand/jumentix-mascot.png"
            alt={portuguese ? 'Mascote Jumentix' : 'Jumentix mascot'}
          />
        </div>
      </section>
      <section className={classes.band}>
        <div className={`${classes.container} ${classes.sectionStack}`}>
          <div className={classes.paginationRow}>
            <SectionHeading
              eyebrow={portuguese ? 'Mudanças publicadas' : 'Published changes'}
              title={portuguese ? `Página ${currentPage} de ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
            />
            <Pagination
              current={currentPage}
              total={Math.min(totalPages, 12)}
              hrefBase={basePath}
            />
          </div>
          <div className={classes.changelogList}>
            {changes.map((change) => (
              <article className={classes.change} key={change.sha ?? `${change.date}-${change.message}`}>
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
                <a href={changeUrl(change)} target="_blank" rel="noreferrer">
                  {portuguese ? 'Ver mudança no GitHub' : 'View change on GitHub'}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
