const verifier = require('../../../../../ci-cd/verify-codecov-public-reports') as {
  reportUrls: (branch: string) => string[];
  verifyCodecovReports: (options: {
    branch: string;
    fetchFn: typeof fetch;
    attempts?: number;
    delay?: (milliseconds: number) => Promise<void>;
  }) => Promise<void>;
};

function svgResponse(status = 200, contentType = 'image/svg+xml') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType }
  } as unknown as Response;
}

describe('verify-codecov-public-reports', () => {
  it('checks both public SVG reports for a long-lived branch', async () => {
    expect.hasAssertions();

    const fetchFn = jest.fn().mockResolvedValue(svgResponse());
    await verifier.verifyCodecovReports({ branch: 'dev', fetchFn });

    expect(fetchFn.mock.calls.map(([url]) => url)).toStrictEqual(verifier.reportUrls('dev'));
  });

  it('does not wait for reports that are not required for a task branch', async () => {
    expect.hasAssertions();

    const fetchFn = jest.fn();
    await verifier.verifyCodecovReports({ branch: 'codex/fix/example', fetchFn });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fails after the configured retry budget when Codecov does not return SVG', async () => {
    expect.hasAssertions();

    await expect(verifier.verifyCodecovReports({
      branch: 'main',
      fetchFn: jest.fn().mockResolvedValue(svgResponse(404, 'text/html')),
      attempts: 1,
      delay: async () => undefined
    })).rejects.toThrow('did not publish an SVG report');
  });
});
