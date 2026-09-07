import {
  applyCatalogCorsDefaults,
  normalizeCatalogCorsAllowedOrigins
} from '@service-management-api/runtime/catalogCors';

describe('service management catalog API CORS defaults', () => {
  it('adds the dev designer origins without dropping the inherited backend origin', () => {
    expect.assertions(1);

    const normalized = normalizeCatalogCorsAllowedOrigins('http://localhost:3000,http://127.0.0.1:3000', 'dev');

    expect(normalized.split(',')).toStrictEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3200',
      'http://127.0.0.1:3200'
    ]);
  });

  it('derives the staging designer origins when no staging allowlist is explicit', () => {
    expect.assertions(1);

    const normalized = normalizeCatalogCorsAllowedOrigins('', 'staging');

    expect(normalized.split(',')).toStrictEqual([
      'http://localhost:4200',
      'http://127.0.0.1:4200'
    ]);
  });

  it('derives the production designer origins without carrying dev ports', () => {
    expect.assertions(1);

    const normalized = normalizeCatalogCorsAllowedOrigins('', 'prod');

    expect(normalized.split(',')).toStrictEqual([
      'http://localhost:5200',
      'http://127.0.0.1:5200'
    ]);
  });

  it('keeps an explicit production allowlist exact', () => {
    expect.assertions(1);

    const normalized = normalizeCatalogCorsAllowedOrigins('https://app.jumentix.example', 'production');

    expect(normalized).toBe('https://app.jumentix.example');
  });

  it.each([
    ['development', '3200'],
    ['local', '3200'],
    ['test', '3200'],
    ['stage', '4200'],
    ['production', '5200'],
    ['preview', '3200'],
    ['', '3200'],
    ['   ', '3200']
  ])('derives the local designer port for %s', (envName, expectedPort) => {
    expect.assertions(1);

    const normalized = normalizeCatalogCorsAllowedOrigins('', envName);

    expect(normalized.split(',')).toStrictEqual([
      `http://localhost:${expectedPort}`,
      `http://127.0.0.1:${expectedPort}`
    ]);
  });

  it('keeps an explicit staging allowlist exact', () => {
    expect.assertions(1);

    const normalized = normalizeCatalogCorsAllowedOrigins('https://staging.jumentix.example', 'staging');

    expect(normalized).toBe('https://staging.jumentix.example');
  });

  it('configures process env shape before the shared Express adapter reads CORS policy', () => {
    expect.assertions(1);

    const env = {
      NODE_ENV: 'staging',
      JUMENTIX_SERVICE_MANAGEMENT_PORT: '4300'
    } as unknown as NodeJS.ProcessEnv;

    applyCatalogCorsDefaults(env);

    expect(env.JUMENTIX_CORS_ALLOWED_ORIGINS).toBe('http://localhost:4300,http://127.0.0.1:4300');
  });
});
