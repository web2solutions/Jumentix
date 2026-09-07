import {
  applyCatalogCorsDefaults,
  normalizeCatalogCorsAllowedOrigins
} from '@service-management-api/runtime/catalogCors';

describe('service management catalog API CORS defaults', () => {
  it('adds the local designer origins without dropping existing origins', () => {
    expect.assertions(1);

    const normalized = normalizeCatalogCorsAllowedOrigins('https://allowed.example, http://localhost:3200');

    expect(normalized.split(',')).toStrictEqual([
      'https://allowed.example',
      'http://localhost:3200',
      'http://127.0.0.1:3200'
    ]);
  });

  it('configures process env shape before the shared Express adapter reads CORS policy', () => {
    expect.assertions(1);

    const env: NodeJS.ProcessEnv = { NODE_ENV: 'test' };

    applyCatalogCorsDefaults(env);

    expect(env.JUMENTIX_CORS_ALLOWED_ORIGINS).toBe('http://localhost:3200,http://127.0.0.1:3200');
  });
});
