import { Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import config from '@/config';

const COMMITS_PER_GITHUB_PAGE = 100;
const CHANGES_PER_PAGE = 200;

interface GitHubCommitResponse {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
  } | null;
}

const clampPage = (value: number): number => {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
};

const parseLastPageFromLinkHeader = (value: string | null): number | null => {
  if (!value) return null;
  const lastMatch = value.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  if (lastMatch && lastMatch[1]) return Number(lastMatch[1]);
  const nextMatch = value.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="next"/);
  if (nextMatch && nextMatch[1]) return Number(nextMatch[1]);
  return null;
};

const toIsoDate = (value: string): string =>
  new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

const fetchCommitPage = async (page: number): Promise<Response> => {
  const url = new URL(config.gitHub.commitsUrl);
  url.searchParams.set('sha', config.gitHub.defaultBranch);
  url.searchParams.set('per_page', String(COMMITS_PER_GITHUB_PAGE));
  url.searchParams.set('page', String(page));

  const baseHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': config.gitHub.repo
  };

  const fetchOptions = {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10000)
  };

  if (process.env.GITHUB_TOKEN) {
    const tokenResponse = await fetch(url.toString(), {
      ...fetchOptions,
      headers: { ...baseHeaders, Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    });

    const rateRemaining = tokenResponse.headers.get('x-ratelimit-remaining');
    const shouldFallback =
      tokenResponse.status === 401 || (tokenResponse.status === 403 && rateRemaining !== '0');

    if (!shouldFallback) {
      return tokenResponse;
    }

    await tokenResponse.text();
  }

  return fetch(url.toString(), { ...fetchOptions, headers: baseHeaders });
};

const loadChangelogPage = async (page: number) => {
  const firstGitHubPage = page * 2 - 1;
  const secondGitHubPage = firstGitHubPage + 1;

  const firstResponse = await fetchCommitPage(firstGitHubPage);
  if (!firstResponse.ok) {
    const body = await firstResponse.text();
    throw new Error(`GitHub commits API error: ${firstResponse.status} ${body.slice(0, 200)}`);
  }

  const firstBatch = (await firstResponse.json()) as GitHubCommitResponse[];
  const lastGitHubPage =
    parseLastPageFromLinkHeader(firstResponse.headers.get('link')) ?? firstGitHubPage;
  const totalPages = Math.max(1, Math.ceil(lastGitHubPage / 2));

  let secondBatch: GitHubCommitResponse[] = [];
  if (secondGitHubPage <= lastGitHubPage) {
    const secondResponse = await fetchCommitPage(secondGitHubPage);
    if (secondResponse.ok) {
      secondBatch = (await secondResponse.json()) as GitHubCommitResponse[];
    }
  }

  const changes = [...firstBatch, ...secondBatch].slice(0, CHANGES_PER_PAGE);
  return {
    changes,
    totalPages,
    currentPage: Math.min(page, totalPages)
  };
};

export const dynamic = 'force-dynamic';

export default async function ChangelogPage({
  searchParams
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const page = clampPage(Number(params.page ?? '1'));
  let changes: GitHubCommitResponse[] = [];
  let totalPages = 1;
  let currentPage = 1;
  let loadError: string | null = null;

  try {
    const result = await loadChangelogPage(page);
    changes = result.changes;
    totalPages = result.totalPages;
    currentPage = result.currentPage;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load changelog data';
    loadError = message;
    // eslint-disable-next-line no-console
    console.error('[changelog-page] failed to fetch commits', message);
  }

  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          <Badge variant="light" size="lg">
            GitHub Changelog
          </Badge>
          <Title order={1}>Jumentix Changelog</Title>
          <Text c="dimmed">
            Change history sourced from GitHub commits for branch{' '}
            <strong>{config.gitHub.defaultBranch}</strong>. Page size: up to {CHANGES_PER_PAGE}{' '}
            changes.
          </Text>
          <Group gap="sm">
            <Button
              component="a"
              href={`https://github.com/${config.gitHub.repo}/commits/${config.gitHub.defaultBranch}`}
              target="_blank"
              rel="noreferrer"
              variant="light"
            >
              Open Full History on GitHub
            </Button>
          </Group>
        </Stack>

        <Group justify="space-between" align="center">
          <Text fw={600}>
            Page {currentPage} of {totalPages}
          </Text>
          <Group gap="sm">
            <Button component="a" href={previousPage ? `/changelog?page=${previousPage}` : '#'} disabled={!previousPage} variant="default">
              Previous
            </Button>
            <Button component="a" href={nextPage ? `/changelog?page=${nextPage}` : '#'} disabled={!nextPage}>
              Next
            </Button>
          </Group>
        </Group>

        {loadError ? (
          <Card withBorder radius="md">
            <Text fw={600}>GitHub changelog is temporarily unavailable.</Text>
            <Text size="sm" c="dimmed" mt={6}>
              {loadError}
            </Text>
          </Card>
        ) : null}

        <Stack gap="sm">
          {changes.map((change) => {
            const firstLine = change.commit.message.split('\n')[0];
            return (
              <Card withBorder radius="md" key={change.sha}>
                <Stack gap={6}>
                  <Group justify="space-between" align="flex-start">
                    <Text fw={700}>{firstLine}</Text>
                    <Badge variant="outline">{change.sha.slice(0, 8)}</Badge>
                  </Group>
                  <Group gap="xs">
                    <Text size="sm" c="dimmed">
                      {toIsoDate(change.commit.author.date)}
                    </Text>
                    <Text size="sm" c="dimmed">
                      by {change.author?.login ?? change.commit.author.name}
                    </Text>
                  </Group>
                  <Text
                    component="a"
                    href={change.html_url}
                    target="_blank"
                    rel="noreferrer"
                    size="sm"
                    c="blue"
                  >
                    View change on GitHub
                  </Text>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Stack>
    </Container>
  );
}
