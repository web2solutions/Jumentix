import config from '@/config';
import { ActionLink, Pagination, SectionHeading, StatusBadge } from '../design-system';
import type { CommercialLocale } from './CommercialPages';
import classes from './CommercialPages.module.css';

const COMMITS_PER_GITHUB_PAGE = 100;
const CHANGES_PER_PAGE = 200;

interface GitHubCommitResponse {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string } | null;
}

const clampPage = (value: number) =>
  Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;

const parseLastPage = (value: string | null) => {
  if (!value) return null;
  const match =
    value.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/) ??
    value.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="next"/);
  return match?.[1] ? Number(match[1]) : null;
};

const fetchCommitPage = async (page: number) => {
  const url = new URL(config.gitHub.commitsUrl);
  url.searchParams.set('sha', config.gitHub.defaultBranch);
  url.searchParams.set('per_page', String(COMMITS_PER_GITHUB_PAGE));
  url.searchParams.set('page', String(page));

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': config.gitHub.repo,
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  return fetch(url, {
    headers,
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10000),
  });
};

const loadChanges = async (page: number) => {
  const firstGitHubPage = page * 2 - 1;
  const firstResponse = await fetchCommitPage(firstGitHubPage);
  if (!firstResponse.ok) throw new Error(`GitHub API returned ${firstResponse.status}`);

  const first = (await firstResponse.json()) as GitHubCommitResponse[];
  const lastGitHubPage = parseLastPage(firstResponse.headers.get('link')) ?? firstGitHubPage;
  const secondGitHubPage = firstGitHubPage + 1;
  const second =
    secondGitHubPage <= lastGitHubPage
      ? ((await (await fetchCommitPage(secondGitHubPage)).json()) as GitHubCommitResponse[])
      : [];

  return {
    changes: [...first, ...second].slice(0, CHANGES_PER_PAGE),
    currentPage: Math.min(page, Math.max(1, Math.ceil(lastGitHubPage / 2))),
    totalPages: Math.max(1, Math.ceil(lastGitHubPage / 2)),
  };
};

const formatDate = (value: string, locale: CommercialLocale) =>
  new Date(value).toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

export async function CommercialChangelogPage({
  locale = 'en',
  page: requestedPage = '1',
}: {
  locale?: CommercialLocale;
  page?: string;
}) {
  const portuguese = locale === 'pt-BR';
  let changes: GitHubCommitResponse[] = [];
  let currentPage = clampPage(Number(requestedPage));
  let totalPages = 1;
  let loadError = false;

  try {
    ({ changes, currentPage, totalPages } = await loadChanges(currentPage));
  } catch (error) {
    loadError = true;
    console.error('[changelog-page] failed to fetch commits', error);
  }

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
          {loadError ? (
            <p>
              {portuguese
                ? 'O GitHub está temporariamente indisponível. Use o link do histórico completo.'
                : 'GitHub is temporarily unavailable. Use the full history link.'}
            </p>
          ) : (
            <div className={classes.changelogList}>
              {changes.map((change) => (
                <article className={classes.change} key={change.sha}>
                  <div className={classes.changeHeader}>
                    <h2>{change.commit.message.split('\n')[0]}</h2>
                    <StatusBadge>{change.sha.slice(0, 8)}</StatusBadge>
                  </div>
                  <div className={classes.changeMeta}>
                    <span>{formatDate(change.commit.author.date, locale)}</span>
                    <span>
                      {portuguese ? 'por' : 'by'}{' '}
                      {change.author?.login ?? change.commit.author.name}
                    </span>
                  </div>
                  <a href={change.html_url} target="_blank" rel="noreferrer">
                    {portuguese ? 'Ver mudança no GitHub' : 'View change on GitHub'}
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
