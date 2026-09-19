const checker = require('../../../../../ci-cd/check-sonar-reliability') as {
  REQUIRED_RELIABILITY_RATING: string;
  buildMeasuresUrl: (branch: string, host?: string) => URL;
  checkSonarReliability: (options: {
    env: Record<string, string>;
    fetchFn: typeof fetch;
  }) => Promise<void>;
  resolveBranch: (env: Record<string, string>) => string;
};

function response(rating: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ component: { measures: [{ metric: 'reliability_rating', value: rating }] } })
  } as Response;
}

describe('check-sonar-reliability', () => {
  it('uses the long-lived branch when querying SonarCloud', () => {
    expect.hasAssertions();

    const url = checker.buildMeasuresUrl('dev');
    expect(url.searchParams.get('branch')).toBe('dev');
    expect(url.searchParams.get('metricKeys')).toBe('reliability_rating');
  });

  it('requires the A reliability rating', async () => {
    expect.hasAssertions();

    await expect(checker.checkSonarReliability({
      env: { SONAR_TOKEN: 'test-token', GITHUB_REF_NAME: 'dev' },
      fetchFn: jest.fn().mockResolvedValue(response(`${checker.REQUIRED_RELIABILITY_RATING}.0`))
    })).resolves.toBeUndefined();
  });

  it('fails when SonarCloud reports a rating below A', async () => {
    expect.hasAssertions();

    await expect(checker.checkSonarReliability({
      env: { SONAR_TOKEN: 'test-token', GITHUB_REF_NAME: 'main' },
      fetchFn: jest.fn().mockResolvedValue(response('4'))
    })).rejects.toThrow('A (1) is required');
  });

  it('does not silently skip an unauthenticated check', async () => {
    expect.hasAssertions();

    await expect(checker.checkSonarReliability({
      env: { GITHUB_REF_NAME: 'dev' },
      fetchFn: jest.fn()
    })).rejects.toThrow('SONAR_TOKEN is required');
  });

  it('prefers an explicit target branch', () => {
    expect.hasAssertions();

    expect(checker.resolveBranch({ SONAR_BRANCH: 'main', GITHUB_REF_NAME: 'dev' })).toBe('main');
  });
});
