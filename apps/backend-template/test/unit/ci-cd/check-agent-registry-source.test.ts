/* eslint-disable @typescript-eslint/no-var-requires */
const https = require('https');

const {
  buildBranchRevisionUrl,
  buildContentsApiUrl,
  buildRawUrl,
  encodeRawPath,
  fetchCanonicalText,
  fetchJson,
  fetchText,
  githubApiHeaders,
  hasGithubToken,
  mirrorsMatch,
  normalize,
  resolveBranchRevision
} = require('../../../../../ci-cd/check-agent-registry-source');

describe('check-agent-registry-source', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds an immutable raw-content URL with encoded path segments', () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    expect(buildRawUrl({
      repository: 'XpertMinds/jumentix-agent-registry',
      revision,
      remotePath: '/registry files/AGENT-REGISTRY.md'
    })).toBe(
      `https://raw.githubusercontent.com/XpertMinds/jumentix-agent-registry/${revision}/registry%20files/AGENT-REGISTRY.md`
    );
  });

  it('rejects invalid repository coordinates', () => {
    expect.hasAssertions();
    expect(() => buildRawUrl({ repository: 'invalid', branch: 'main', remotePath: 'AGENT-REGISTRY.md' }))
      .toThrow('Invalid repository format');
  });

  it('uses an immutable configured revision when building the canonical content URL', () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    expect(buildRawUrl({
      repository: 'XpertMinds/jumentix-agent-registry',
      branch: 'main',
      revision,
      remotePath: 'AGENT-REGISTRY.md'
    })).toContain(`/${revision}/AGENT-REGISTRY.md`);
  });

  it('rejects mutable refs and unsafe registry paths', () => {
    expect.hasAssertions();
    expect(() => buildRawUrl({
      repository: 'XpertMinds/jumentix-agent-registry',
      revision: 'main',
      remotePath: 'AGENT-REGISTRY.md'
    })).toThrow('full immutable commit SHA');
    expect(() => encodeRawPath('../AGENT-REGISTRY.md')).toThrow('Invalid registry remote path');
  });

  it('builds the branch revision URL used by synchronization', () => {
    expect.hasAssertions();
    expect(buildBranchRevisionUrl({
      repository: 'XpertMinds/jumentix-agent-registry',
      branch: 'main/next'
    })).toBe('https://api.github.com/repos/XpertMinds/jumentix-agent-registry/commits/main%2Fnext');
  });

  it('normalizes line endings and trailing whitespace before comparing registry mirrors', () => {
    expect.hasAssertions();
    expect(normalize('registry\r\nentry\r\n\r\n')).toBe('registry\nentry');
    expect(mirrorsMatch('registry\r\nentry\n', 'registry\nentry')).toBe(true);
    expect(mirrorsMatch('registry\nlocal', 'registry\ncanonical')).toBe(false);
  });

  it('requests immutable canonical content without GitHub API authentication', async () => {
    expect.hasAssertions();
    const response = {
      statusCode: 200,
      setEncoding: jest.fn(),
      on: jest.fn()
    };
    const request = { on: jest.fn() };

    response.on.mockImplementation((event: string, handler: (value?: string) => void) => {
      const responseEvents: Record<string, () => void> = {
        data: () => handler('canonical'),
        end: () => handler()
      };
      responseEvents[event]();
      return response;
    });
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, options, callback] = args as [string, object, (value: object) => void];
      expect(options).toStrictEqual({
        headers: {
          Accept: 'text/plain',
          'User-Agent': 'jumentix-agent-registry-check'
        }
      });
      callback(response);
      return request as never;
    });

    await expect(fetchText('https://raw.githubusercontent.com/XpertMinds/jumentix-agent-registry/revision/AGENT-REGISTRY.md'))
      .resolves.toBe('canonical');
  });

  it('fetches private canonical content through the authenticated Contents API when a token is present', async () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    const response = {
      statusCode: 200,
      setEncoding: jest.fn(),
      on: jest.fn()
    };
    const request = { on: jest.fn() };

    response.on.mockImplementation((event: string, handler: (value?: string) => void) => {
      const responseEvents: Record<string, () => void> = {
        data: () => handler('private-canonical'),
        end: () => handler()
      };
      responseEvents[event]();
      return response;
    });
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [url, options, callback] = args as [
        string,
        { headers: Record<string, string> },
        (value: object) => void
      ];
      expect(url).toBe(buildContentsApiUrl({
        repository: 'XpertMinds/jumentix-agent-registry',
        revision,
        remotePath: 'AGENT-REGISTRY.md'
      }, revision));
      expect(options.headers.Authorization).toBe('Bearer private-token');
      expect(options.headers.Accept).toBe('application/vnd.github.raw');
      callback(response);
      return request as never;
    });

    await expect(fetchCanonicalText({
      repository: 'XpertMinds/jumentix-agent-registry',
      revision,
      remotePath: 'AGENT-REGISTRY.md'
    }, revision, { GITHUB_TOKEN: 'private-token' })).resolves.toStrictEqual({
      content: 'private-canonical',
      sourceUrl: buildContentsApiUrl({
        repository: 'XpertMinds/jumentix-agent-registry',
        revision,
        remotePath: 'AGENT-REGISTRY.md'
      }, revision)
    });
    expect(hasGithubToken({ GITHUB_TOKEN: 'private-token' })).toBe(true);
  });

  it('falls back to public raw fetch when a token Contents API request is unauthorized', async () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    const request = { on: jest.fn() };
    const getRequest = jest.spyOn(https, 'get');
    getRequest.mockImplementationOnce((...args: unknown[]) => {
      const [url, , callback] = args as [string, object, (value: object) => void];
      expect(url).toContain('api.github.com/repos/');
      callback({
        statusCode: 403,
        setEncoding: jest.fn(),
        on: jest.fn(),
        resume: jest.fn()
      });
      return request as never;
    });

    getRequest.mockImplementationOnce((...args: unknown[]) => {
      const [url, , callback] = args as [string, object, (value: object) => void];
      expect(url).toBe(buildRawUrl({
        repository: 'XpertMinds/jumentix-agent-registry',
        revision,
        remotePath: 'AGENT-REGISTRY.md'
      }, revision));
      const response = {
        statusCode: 200,
        setEncoding: jest.fn(),
        on: jest.fn()
      };
      response.on.mockImplementation((event: string, handler: (value?: string) => void) => {
        const responseEvents: Record<string, () => void> = {
          data: () => handler('public-canonical'),
          end: () => handler()
        };
        responseEvents[event]();
        return response;
      });
      callback(response);
      return request as never;
    });

    await expect(fetchCanonicalText({
      repository: 'XpertMinds/jumentix-agent-registry',
      revision,
      remotePath: 'AGENT-REGISTRY.md'
    }, revision, { GITHUB_TOKEN: 'stale-token' })).resolves.toStrictEqual({
      content: 'public-canonical',
      sourceUrl: buildRawUrl({
        repository: 'XpertMinds/jumentix-agent-registry',
        revision,
        remotePath: 'AGENT-REGISTRY.md'
      }, revision)
    });
    expect(getRequest).toHaveBeenCalledTimes(2);
  });

  it('guides operators to pin/path drift on unauthenticated raw 404 responses', async () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    const request = { on: jest.fn() };
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, , callback] = args as [string, object, (value: object) => void];
      callback({
        statusCode: 404,
        setEncoding: jest.fn(),
        on: jest.fn(),
        resume: jest.fn()
      });
      return request as never;
    });

    await expect(fetchCanonicalText({
      repository: 'XpertMinds/jumentix-agent-registry',
      revision,
      remotePath: 'AGENT-REGISTRY.md'
    }, revision, {})).rejects.toThrow('Verify the pinned revision SHA and remotePath');
  });

  it('still points unauthenticated 401/403 failures at token-backed private access', async () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    const request = { on: jest.fn() };
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, , callback] = args as [string, object, (value: object) => void];
      callback({
        statusCode: 401,
        setEncoding: jest.fn(),
        on: jest.fn(),
        resume: jest.fn()
      });
      return request as never;
    });

    await expect(fetchCanonicalText({
      repository: 'XpertMinds/jumentix-agent-registry',
      revision,
      remotePath: 'AGENT-REGISTRY.md'
    }, revision, {})).rejects.toThrow('Private canonical registry access requires GITHUB_TOKEN or GH_TOKEN');
  });

  it('keeps token-access guidance when Contents API auth fails and raw returns 404', async () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    const request = { on: jest.fn() };
    const getRequest = jest.spyOn(https, 'get');
    getRequest.mockImplementationOnce((...args: unknown[]) => {
      const [, , callback] = args as [string, object, (value: object) => void];
      callback({
        statusCode: 403,
        setEncoding: jest.fn(),
        on: jest.fn(),
        resume: jest.fn()
      });
      return request as never;
    });
    getRequest.mockImplementationOnce((...args: unknown[]) => {
      const [, , callback] = args as [string, object, (value: object) => void];
      callback({
        statusCode: 404,
        setEncoding: jest.fn(),
        on: jest.fn(),
        resume: jest.fn()
      });
      return request as never;
    });

    await expect(fetchCanonicalText({
      repository: 'XpertMinds/jumentix-agent-registry',
      revision,
      remotePath: 'AGENT-REGISTRY.md'
    }, revision, { GITHUB_TOKEN: 'bad-token' })).rejects.toThrow(
      /Authenticated Contents API failed and public raw fetch returned HTTP 404/
    );
    expect(getRequest).toHaveBeenCalledTimes(2);
  });

  it('rejects failed canonical registry responses', async () => {
    expect.hasAssertions();
    const response = {
      statusCode: 404,
      setEncoding: jest.fn(),
      on: jest.fn()
    };
    const request = { on: jest.fn() };
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, , callback] = args as [string, object, (value: object) => void];
      callback(response);
      return request as never;
    });

    await expect(fetchText('https://api.github.com/repos/XpertMinds/jumentix-agent-registry/contents/missing'))
      .rejects.toThrow('HTTP 404');
  });

  it('wraps canonical registry transport failures without leaking credentials', async () => {
    expect.hasAssertions();
    const request: { on: jest.Mock } = { on: jest.fn() };
    request.on.mockImplementation((event: string, handler: (error: Error) => void) => {
      expect(event).toBe('error');
      handler(new Error('socket unavailable'));
      return request;
    });
    jest.spyOn(https, 'get').mockReturnValue(request as never);

    await expect(fetchText('https://raw.githubusercontent.com/example/revision/file'))
      .rejects.toThrow('immutable canonical registry content: socket unavailable');
  });

  it('adds API authentication only when branch resolution has an available token', () => {
    expect.hasAssertions();
    expect(githubApiHeaders({})).toStrictEqual({
      Accept: 'application/vnd.github+json',
      'User-Agent': 'jumentix-agent-registry-check'
    });
    expect(githubApiHeaders({ GITHUB_TOKEN: 'secret-value' })).toStrictEqual({
      Accept: 'application/vnd.github+json',
      'User-Agent': 'jumentix-agent-registry-check',
      Authorization: 'Bearer secret-value'
    });
  });

  it('parses canonical GitHub JSON responses', async () => {
    expect.hasAssertions();
    const response = {
      statusCode: 200,
      setEncoding: jest.fn(),
      on: jest.fn()
    };
    const request = { on: jest.fn() };

    response.on.mockImplementation((event: string, handler: (value?: string) => void) => {
      const responseEvents: Record<string, () => void> = {
        data: () => handler('{"sha":"0123456789abcdef0123456789abcdef01234567"}'),
        end: () => handler()
      };
      responseEvents[event]();
      return response;
    });
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, options, callback] = args as [string, object, (value: object) => void];
      expect(options).toStrictEqual({
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'jumentix-agent-registry-check'
        }
      });
      callback(response);
      return request as never;
    });

    await expect(fetchJson('https://api.github.com/example', {}))
      .resolves.toStrictEqual({ sha: '0123456789abcdef0123456789abcdef01234567' });
  });

  it('resolves the immutable revision for the configured canonical branch', async () => {
    expect.hasAssertions();
    const revision = '0123456789abcdef0123456789abcdef01234567';
    const response = {
      statusCode: 200,
      setEncoding: jest.fn(),
      on: jest.fn()
    };
    const request = { on: jest.fn() };

    response.on.mockImplementation((event: string, handler: (value?: string) => void) => {
      const responseEvents: Record<string, () => void> = {
        data: () => handler(JSON.stringify({ sha: revision })),
        end: () => handler()
      };
      responseEvents[event]();
      return response;
    });
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, , callback] = args as [string, object, (value: object) => void];
      callback(response);
      return request as never;
    });

    await expect(resolveBranchRevision({
      repository: 'XpertMinds/jumentix-agent-registry',
      branch: 'main'
    })).resolves.toBe(revision);
  });

  it('fails closed when branch resolution does not return a full commit SHA', async () => {
    expect.hasAssertions();
    const response = {
      statusCode: 200,
      setEncoding: jest.fn(),
      on: jest.fn()
    };
    const request = { on: jest.fn() };

    response.on.mockImplementation((event: string, handler: (value?: string) => void) => {
      const responseEvents: Record<string, () => void> = {
        data: () => handler('{"sha":"main"}'),
        end: () => handler()
      };
      responseEvents[event]();
      return response;
    });
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, , callback] = args as [string, object, (value: object) => void];
      callback(response);
      return request as never;
    });

    await expect(resolveBranchRevision({
      repository: 'XpertMinds/jumentix-agent-registry',
      branch: 'main'
    })).rejects.toThrow('Could not resolve canonical registry revision');
  });
});
