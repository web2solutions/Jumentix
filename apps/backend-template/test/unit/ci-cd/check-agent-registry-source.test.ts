/* eslint-disable @typescript-eslint/no-var-requires */
const https = require('https');

const {
  buildRawUrl,
  fetchText,
  normalize
} = require('../../../../../ci-cd/check-agent-registry-source');

describe('check-agent-registry-source', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the GitHub contents API URL for the configured registry branch', () => {
    expect.hasAssertions();
    expect(buildRawUrl({
      repository: 'web2solutions/jumentix-agent-registry',
      branch: 'main/next',
      remotePath: '/AGENT-REGISTRY.md'
    })).toBe('https://api.github.com/repos/web2solutions/jumentix-agent-registry/contents/AGENT-REGISTRY.md?ref=main%2Fnext');
  });

  it('rejects invalid repository coordinates', () => {
    expect.hasAssertions();
    expect(() => buildRawUrl({ repository: 'invalid', branch: 'main', remotePath: 'AGENT-REGISTRY.md' }))
      .toThrow('Invalid repository format');
  });

  it('normalizes line endings and trailing whitespace before comparing registry mirrors', () => {
    expect.hasAssertions();
    expect(normalize('registry\r\nentry\r\n\r\n')).toBe('registry\nentry');
  });

  it('requests raw canonical content from the GitHub contents API', async () => {
    expect.hasAssertions();
    const response = {
      statusCode: 200,
      setEncoding: jest.fn(),
      on: jest.fn()
    };
    const request = { on: jest.fn() };

    response.on.mockImplementation((event: string, handler: (value?: string) => void) => {
      const responseEvents = new Map<string, () => void>([
        ['data', () => handler('canonical')],
        ['end', () => handler()]
      ]);
      responseEvents.get(event)!();
      return response;
    });
    jest.spyOn(https, 'get').mockImplementation((...args: unknown[]) => {
      const [, options, callback] = args as [string, object, (value: object) => void];
      expect(options).toStrictEqual({
        headers: {
          Accept: 'application/vnd.github.raw+json',
          'User-Agent': 'jumentix-agent-registry-check'
        }
      });
      callback(response);
      return request as never;
    });

    await expect(fetchText('https://api.github.com/repos/web2solutions/jumentix-agent-registry/contents/AGENT-REGISTRY.md?ref=main'))
      .resolves.toBe('canonical');
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

    await expect(fetchText('https://api.github.com/repos/web2solutions/jumentix-agent-registry/contents/missing'))
      .rejects.toThrow('HTTP 404');
  });
});
