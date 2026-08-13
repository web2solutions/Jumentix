import releases from '@/content/releases.json';

// jsdom has no web Response global; the route handler only needs
// Response.json + status/body, so stub the minimal contract before import.
class ResponseStub {
  status = 200;

  headers: Record<string, string>;

  private readonly body: unknown;

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.headers = init?.headers ?? {};
  }

  static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    return new ResponseStub(body, init);
  }

  json() {
    return Promise.resolve(this.body);
  }
}
globalThis.Response = ResponseStub as unknown as typeof Response;

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const { GET } = require('./route') as typeof import('./route');

// the handler only reads headers, so a plain stub replaces the Request global
const stubRequest = (userAgent?: string) => ({
  headers: { get: (name: string) => (name === 'user-agent' ? (userAgent ?? null) : null) }
}) as unknown as Request;

describe('/api/github-releases (JUM-719)', () => {
  it('serves the bundled release snapshot without any GitHub API call', async () => {
    expect.hasAssertions();
    const response = GET(stubRequest('Mozilla/5.0'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.releases)).toBe(true);
    expect(body.releases).toHaveLength(releases.length);
  });

  it('rejects bots', () => {
    expect.hasAssertions();
    const response = GET(stubRequest('Googlebot'));
    expect(response.status).toBe(403);
  });

  it('requires a user agent', () => {
    expect.hasAssertions();
    const response = GET(stubRequest());
    expect(response.status).toBe(400);
  });
});
