import releases from '@/content/releases.json';

/**
 * Serves the release notes snapshot baked at build time by
 * `scripts/sync-releases.mjs` (JUM-719). The route used to proxy the GitHub
 * releases API at request time; the public canonical repository answers
 * unauthenticated calls with 404, which broke the page in every environment
 * without a valid GITHUB_TOKEN. The data is now bundled by Next.js, so the
 * route has no runtime secret or network dependency.
 */
export function GET(request: Request) {
  const userAgent = request.headers.get('user-agent');

  if (!userAgent) {
    return Response.json({ error: 'User agent not found' }, { status: 400 });
  }

  const isBot = /bot|crawl|slurp|spider/i.test(userAgent);

  if (isBot) {
    return Response.json({ error: 'Bots are not allowed' }, { status: 403 });
  }

  return Response.json(
    { releases, status: 'ok' },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        Vary: 'User-Agent'
      }
    }
  );
}
