import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ACCEPTED_RISK,
  FATAL_SEVERITIES,
  NON_BLOCKING_SEVERITIES,
  evaluatePackages,
  isAcceptedRisk,
  scanner,
  severityOf
} from '../src/index.js';
import type { IAdvisory, IOsvVulnerability } from '../src/index.js';

/**
 * Requirement 112 — this package owns its suite.
 *
 * It had none, and its `test` script was `bun run typecheck`, which is an echo.
 * That is a poor arrangement for any package and an indefensible one for this
 * package: it is the thing that decides whether an install proceeds, running
 * over the whole dependency graph on every `bun install`. Its own docstring
 * says a silent success is the failure mode it exists to prevent, and nothing
 * checked that it did.
 *
 * The two ends are covered differently. `evaluatePackages` takes its network
 * layer as a parameter, so the policy — what is fatal, what is accepted, what
 * is dropped — is exercised directly. The HTTP layer underneath it is exercised
 * against a real `http.Server` on loopback, reached by pointing `fetch` at it:
 * real requests, real status codes, real JSON parsing, so a 500 and a malformed
 * body behave here as they would against OSV.
 */

type OsvBatchResponse = { results?: Array<{ vulns?: Array<{ id?: string }> }> };

const pkg = (name: string, version = '1.0.0') => ({ name, version });

/** An OSV record at the given severity label. */
const vulnerability = (severity: string, over: IOsvVulnerability = {}): IOsvVulnerability => ({
  summary: 'a summary',
  database_specific: { severity },
  ...over
});

/** Answers the batch lookup with the given ids for the first package. */
const batchReturning = (...ids: string[]) => async (): Promise<OsvBatchResponse> => ({
  results: [{ vulns: ids.map((id) => ({ id })) }]
});

describe('severity mapping', () => {
  it.each([
    ['CRITICAL', 'CRITICAL'],
    ['high', 'HIGH'],
    ['Moderate', 'MODERATE'],
    ['low', 'LOW']
  ])('reads the database label %p as %p', (labelled: string, expected: string) => {
    expect.hasAssertions();

    expect(severityOf(vulnerability(labelled))).toBe(expected);
  });

  /**
   * The CVSS fallback, with the boundaries asserted rather than assumed: 7.0 is
   * the difference between an install that stops and one that prompts.
   */
  it.each([
    ['10', 'CRITICAL'],
    ['9', 'CRITICAL'],
    ['8.9', 'HIGH'],
    ['7', 'HIGH'],
    ['6.9', 'MODERATE'],
    ['4', 'MODERATE'],
    ['3.9', 'LOW'],
    ['0', 'LOW']
  ])('reads a CVSS score of %p as %p', (score: string, expected: string) => {
    expect.hasAssertions();

    expect(severityOf({ severity: [{ type: 'CVSS_V3', score }] })).toBe(expected);
  });

  it('ignores a severity entry that is not CVSS', () => {
    expect.hasAssertions();

    expect(severityOf({ severity: [{ type: 'OTHER', score: '9' }] })).toBe('MODERATE');
  });

  /**
   * A CVSS vector string is not a number. Parsed as one it becomes NaN, and the
   * comparisons below would all be false — so the vector form has to fall
   * through to the default rather than silently produce LOW.
   */
  it('does not read a CVSS vector string as a score', () => {
    expect.hasAssertions();

    const vector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';

    expect(severityOf({ severity: [{ type: 'CVSS_V3', score: vector }] })).toBe('MODERATE');
  });

  /**
   * Unknown maps to MODERATE, not to nothing. An unrated advisory is still an
   * advisory, and defaulting it away would be a quiet downgrade.
   */
  it.each([
    ['an empty record', {}],
    ['a missing record', undefined],
    ['a record with no severity at all', { summary: 'x' }],
    ['a CVSS entry with no score', { severity: [{ type: 'CVSS_V3' }] }]
  ])('treats %s as MODERATE', (_case: string, input: IOsvVulnerability | undefined) => {
    expect.hasAssertions();

    expect(severityOf(input)).toBe('MODERATE');
  });
});

describe('the policy constants', () => {
  it('stops an install only for critical and high', () => {
    expect.hasAssertions();

    expect([...FATAL_SEVERITIES].sort()).toStrictEqual(['CRITICAL', 'HIGH']);
  });

  it('emits nothing at all for low, none and unknown', () => {
    expect.hasAssertions();

    // Both of Bun's levels stop CI, so anything emitted here fails every
    // install on an informational finding.
    expect([...NON_BLOCKING_SEVERITIES].sort()).toStrictEqual(['LOW', 'NONE', 'UNKNOWN']);
  });

  /**
   * Every accepted risk carries an expiry, and an expired one stops
   * suppressing. Without the date these become permanent exemptions under a
   * name that says they are not.
   */
  it('gives every accepted risk an expiry and a reason', () => {
    expect.hasAssertions();

    for (const [id, entry] of Object.entries(ACCEPTED_RISK)) {
      expect(id).toMatch(/^GHSA-/);
      expect(entry.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });
});

describe('accepted risk', () => {
  const [anAcceptedId] = Object.keys(ACCEPTED_RISK);
  const expiry = ACCEPTED_RISK[anAcceptedId].until;

  it('suppresses a known advisory before its expiry', () => {
    expect.hasAssertions();

    expect(isAcceptedRisk(anAcceptedId, new Date(`${expiry}T00:00:00.000Z`))).toBe(true);
  });

  it('suppresses it through the last second of the expiry day', () => {
    expect.hasAssertions();

    expect(isAcceptedRisk(anAcceptedId, new Date(`${expiry}T23:59:59.000Z`))).toBe(true);
  });

  /** The ratchet: the day after, the advisory comes back. */
  it('stops suppressing once the expiry has passed', () => {
    expect.hasAssertions();

    const afterwards = new Date(`${expiry}T23:59:59.001Z`);

    expect(isAcceptedRisk(anAcceptedId, afterwards)).toBe(false);
  });

  it('accepts nothing it has not been told about', () => {
    expect.hasAssertions();

    expect(isAcceptedRisk('GHSA-not-a-real-advisory')).toBe(false);
  });

  it('defaults to now when given no date', () => {
    expect.hasAssertions();

    // Whether this is currently suppressed depends on today's date; that it
    // answers without a date argument does not.
    expect(typeof isAcceptedRisk(anAcceptedId)).toBe('boolean');
  });
});

describe('evaluating a package set', () => {
  it('reports nothing for an empty set without asking OSV', async () => {
    expect.hasAssertions();

    let asked = 0;
    const advisories = await evaluatePackages([], {
      batch: async () => { asked += 1; return {}; }
    });

    expect(advisories).toStrictEqual([]);
    expect(asked).toBe(0);
  });

  it('ignores entries with no name or no version', async () => {
    expect.hasAssertions();

    let asked = 0;
    const incomplete = [
      { name: 'a', version: '' },
      { name: '', version: '1.0.0' },
      undefined,
      null
    ] as never;

    const advisories = await evaluatePackages(incomplete, {
      batch: async () => { asked += 1; return {}; }
    });

    expect(advisories).toStrictEqual([]);
    expect(asked).toBe(0);
  });

  it('asks OSV for the npm ecosystem at the exact resolved version', async () => {
    expect.hasAssertions();

    let asked: unknown;
    await evaluatePackages([pkg('left-pad', '1.3.0')], {
      batch: async (queries) => { asked = queries; return { results: [{}] }; }
    });

    expect(asked).toStrictEqual([
      { package: { name: 'left-pad', ecosystem: 'npm' }, version: '1.3.0' }
    ]);
  });

  it('reports a critical advisory as fatal', async () => {
    expect.hasAssertions();

    const advisories: IAdvisory[] = await evaluatePackages([pkg('left-pad')], {
      batch: batchReturning('GHSA-aaaa-bbbb-cccc'),
      detail: async () => vulnerability('CRITICAL', { summary: 'remote code execution' })
    });

    expect(advisories).toStrictEqual([{
      level: 'fatal',
      package: 'left-pad@1.0.0',
      url: 'https://osv.dev/vulnerability/GHSA-aaaa-bbbb-cccc',
      description: 'CRITICAL: remote code execution'
    }]);
  });

  it('reports a moderate advisory as warn', async () => {
    expect.hasAssertions();

    const [advisory] = await evaluatePackages([pkg('left-pad')], {
      batch: batchReturning('GHSA-aaaa-bbbb-cccc'),
      detail: async () => vulnerability('MODERATE')
    });

    expect(advisory.level).toBe('warn');
  });

  it('reports nothing for a low advisory', async () => {
    expect.hasAssertions();

    const advisories = await evaluatePackages([pkg('left-pad')], {
      batch: batchReturning('GHSA-aaaa-bbbb-cccc'),
      detail: async () => vulnerability('LOW')
    });

    expect(advisories).toStrictEqual([]);
  });

  it('falls back to the advisory id when the record has no summary', async () => {
    expect.hasAssertions();

    const [advisory] = await evaluatePackages([pkg('left-pad')], {
      batch: batchReturning('GHSA-aaaa-bbbb-cccc'),
      detail: async () => vulnerability('HIGH', { summary: undefined })
    });

    expect(advisory.description).toBe('HIGH: GHSA-aaaa-bbbb-cccc');
  });

  it('drops an advisory that is currently accepted risk', async () => {
    expect.hasAssertions();

    const [accepted] = Object.keys(ACCEPTED_RISK);
    const advisories = await evaluatePackages([pkg('restify')], {
      batch: batchReturning(accepted),
      detail: async () => vulnerability('CRITICAL'),
      now: new Date(`${ACCEPTED_RISK[accepted].until}T00:00:00.000Z`)
    });

    expect(advisories).toStrictEqual([]);
  });

  /** The same ratchet, seen from the scanner rather than from the predicate. */
  it('reports an accepted advisory again once its acceptance has expired', async () => {
    expect.hasAssertions();

    const [accepted] = Object.keys(ACCEPTED_RISK);
    const advisories = await evaluatePackages([pkg('restify')], {
      batch: batchReturning(accepted),
      detail: async () => vulnerability('CRITICAL'),
      now: new Date('2099-01-01T00:00:00.000Z')
    });

    expect(advisories).toHaveLength(1);
  });

  it('fetches each advisory once however many packages carry it', async () => {
    expect.hasAssertions();

    const fetched: string[] = [];
    await evaluatePackages([pkg('a'), pkg('b')], {
      batch: async (queries) => ({
        results: queries.map(() => ({ vulns: [{ id: 'GHSA-shared' }] }))
      }),
      detail: async (id) => { fetched.push(id); return vulnerability('HIGH'); }
    });

    // Two packages, one advisory, one request. The cache is what keeps the
    // request count proportional to findings rather than to the tree.
    expect(fetched).toStrictEqual(['GHSA-shared']);
  });

  it('reports one advisory per affected package', async () => {
    expect.hasAssertions();

    const advisories = await evaluatePackages([pkg('a'), pkg('b')], {
      batch: async (queries) => ({
        results: queries.map(() => ({ vulns: [{ id: 'GHSA-shared' }] }))
      }),
      detail: async () => vulnerability('HIGH')
    });

    expect(advisories.map((advisory) => advisory.package)).toStrictEqual(['a@1.0.0', 'b@1.0.0']);
  });

  it('splits a tree larger than one batch into several requests', async () => {
    expect.hasAssertions();

    const sizes: number[] = [];
    const large = Array.from({ length: 1001 }, (_unused, index) => pkg(`p${index}`));

    await evaluatePackages(large, {
      batch: async (queries) => {
        sizes.push(queries.length);
        return { results: queries.map(() => ({})) };
      }
    });

    // OSV accepts 1000 queries per request; a tree of 1001 must not be silently
    // truncated to the first batch.
    expect(sizes).toStrictEqual([1000, 1]);
  });

  it('skips the detail lookups entirely when nothing matched', async () => {
    expect.hasAssertions();

    let fetched = 0;
    const advisories = await evaluatePackages([pkg('a')], {
      batch: async () => ({ results: [{ vulns: [] }] }),
      detail: async () => { fetched += 1; return vulnerability('HIGH'); }
    });

    expect(advisories).toStrictEqual([]);
    expect(fetched).toBe(0);
  });
});

describe('refusing to guess', () => {
  /**
   * The centre of this package. OSV answering with a different number of
   * results than were asked for means the mapping from result to package is
   * unknown — and an unknown mapping read as "clean" is precisely the silent
   * success the scanner exists to prevent.
   */
  it.each([
    ['fewer results than packages', { results: [] }],
    ['more results than packages', { results: [{}, {}] }],
    ['no results field', {}],
    ['a results field that is not an array', { results: 'ok' }],
    ['nothing at all', undefined],
    ['null', null]
  ])('refuses a batch response with %s', async (_case: string, payload: unknown) => {
    expect.hasAssertions();

    await expect(evaluatePackages([pkg('a')], { batch: async () => payload as never }))
      .rejects.toThrow('refusing to treat an unverifiable result as clean');
  });

  it('lets a network failure through rather than reporting clean', async () => {
    expect.hasAssertions();

    await expect(evaluatePackages([pkg('a')], {
      batch: async () => { throw new Error('getaddrinfo ENOTFOUND api.osv.dev'); }
    })).rejects.toThrow('ENOTFOUND');
  });

  it('lets a failure fetching an advisory through', async () => {
    expect.hasAssertions();

    await expect(evaluatePackages([pkg('a')], {
      batch: batchReturning('GHSA-aaaa-bbbb-cccc'),
      detail: async () => { throw new Error('HTTP 503'); }
    })).rejects.toThrow('HTTP 503');
  });
});

describe('the Bun scanner contract', () => {
  it('declares version 1', () => {
    expect.hasAssertions();

    // Bun dispatches on this; a wrong value means the scanner is never called
    // and every install is unscanned.
    expect(scanner.version).toBe('1');
  });
});

/**
 * The HTTP layer, against a real server.
 *
 * `postJson` and `getJson` are internal, so they are reached the way production
 * reaches them: through `evaluatePackages` and `scanner.scan` with no injected
 * io. `fetch` is redirected from api.osv.dev to a local `http.Server` — a
 * global function, replaced and restored, which behaves the same under both of
 * this repository's runners unlike module substitution (JUM-583). Everything
 * past that point is real: a real request, a real status line, a real body.
 */
type TReply = { status: number; body: string };

const ok = (payload: unknown): TReply => ({ status: 200, body: JSON.stringify(payload) });
const failing = (status: number): TReply => ({ status, body: 'the server said no' });
const oneVulnerability = (id: string) => ok({ results: [{ vulns: [{ id }] }] });

describe('the OSV transport', () => {
  let server: http.Server;
  let origin: string;
  let originalFetch: typeof fetch;
  let requested: string[];
  let routes: { batch: TReply; detail: TReply };

  beforeEach(async () => {
    requested = [];
    server = http.createServer((request, response) => {
      const url = request.url || '/';
      requested.push(url);
      // The routing lives here rather than in each test: OSV has two endpoints,
      // and which one answered is the server's business.
      const { status, body } = url.includes('querybatch') ? routes.batch : routes.detail;
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(body);
    });

    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    originalFetch = globalThis.fetch;
    globalThis.fetch = ((input: string, init?: RequestInit) => originalFetch(
      String(input).replace('https://api.osv.dev', origin),
      init
    )) as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
  });

  it('posts the batch query and reads the response back', async () => {
    expect.hasAssertions();

    routes = {
      batch: oneVulnerability('GHSA-x'),
      detail: ok(vulnerability('HIGH', { summary: 'over the wire' }))
    };

    const advisories = await evaluatePackages([pkg('left-pad')]);

    expect(advisories).toStrictEqual([{
      level: 'fatal',
      package: 'left-pad@1.0.0',
      url: 'https://osv.dev/vulnerability/GHSA-x',
      description: 'HIGH: over the wire'
    }]);
  });

  /**
   * An HTTP error must not be read as "no vulnerabilities". This is the failure
   * the whole design is arranged around, so it is asserted at the transport
   * rather than only at the policy layer.
   */
  it('throws, naming the status, when the batch request fails', async () => {
    expect.hasAssertions();

    routes = { batch: failing(503), detail: failing(503) };

    await expect(evaluatePackages([pkg('left-pad')]))
      .rejects.toThrow(/OSV request failed: HTTP 503 .*querybatch/);
  });

  it('throws, naming the status, when an advisory lookup fails', async () => {
    expect.hasAssertions();

    routes = { batch: oneVulnerability('GHSA-x'), detail: failing(404) };

    await expect(evaluatePackages([pkg('left-pad')]))
      .rejects.toThrow(/OSV request failed: HTTP 404 .*vulns\/GHSA-x/);
  });

  it('percent-encodes an advisory id into the lookup url', async () => {
    expect.hasAssertions();

    routes = { batch: oneVulnerability('GHSA-a/b'), detail: ok(vulnerability('HIGH')) };

    await evaluatePackages([pkg('left-pad')]);

    // Unencoded, the slash would change the path and the lookup would 404.
    expect(requested[1]).toBe('/v1/vulns/GHSA-a%2Fb');
  });

  it('runs the whole scan through the Bun entry point', async () => {
    expect.hasAssertions();

    routes = { batch: ok({ results: [{ vulns: [] }] }), detail: ok({}) };

    await expect(scanner.scan({ packages: [pkg('left-pad')] })).resolves.toStrictEqual([]);
  });

  /** No try/catch in `scan`: a thrown error is what cancels the install. */
  it('lets a transport failure out of the Bun entry point', async () => {
    expect.hasAssertions();

    routes = { batch: failing(500), detail: failing(500) };

    await expect(scanner.scan({ packages: [pkg('left-pad')] })).rejects.toThrow('HTTP 500');
  });
});
