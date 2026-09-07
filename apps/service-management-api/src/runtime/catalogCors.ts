const SERVICE_MANAGEMENT_DESIGNER_PORT_BY_ENV: Record<string, string> = {
  dev: '3200',
  development: '3200',
  local: '3200',
  test: '3200',
  staging: '4200',
  stage: '4200',
  prod: '5200',
  production: '5200'
};

const splitOrigins = (configured = ''): string[] => configured
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const normalizeRuntimeEnv = (value = ''): string => String(value || 'dev').trim().toLowerCase() || 'dev';

const serviceManagementLocalOrigins = (envName = 'dev', port = ''): string[] => {
  const resolvedPort = String(port || '').trim()
    || SERVICE_MANAGEMENT_DESIGNER_PORT_BY_ENV[normalizeRuntimeEnv(envName)]
    || SERVICE_MANAGEMENT_DESIGNER_PORT_BY_ENV.dev;
  return [
    `http://localhost:${resolvedPort}`,
    `http://127.0.0.1:${resolvedPort}`
  ];
};

export const normalizeCatalogCorsAllowedOrigins = (
  configured = '',
  envName = 'dev',
  serviceManagementPort = ''
): string => {
  const runtimeEnv = normalizeRuntimeEnv(envName);
  const configuredOrigins = splitOrigins(configured);
  const origins = new Set(configuredOrigins);
  const hasExplicitNonDevAllowlist = configuredOrigins.length > 0
    && !['dev', 'development', 'local', 'test'].includes(runtimeEnv);
  if (!hasExplicitNonDevAllowlist) {
    serviceManagementLocalOrigins(runtimeEnv, serviceManagementPort)
      .forEach((origin) => origins.add(origin));
  }
  return Array.from(origins).join(',');
};

export const applyCatalogCorsDefaults = (env: NodeJS.ProcessEnv = process.env): void => {
  Object.assign(env, {
    JUMENTIX_CORS_ALLOWED_ORIGINS: normalizeCatalogCorsAllowedOrigins(
      env.JUMENTIX_CORS_ALLOWED_ORIGINS,
      env.NODE_ENV,
      env.JUMENTIX_SERVICE_MANAGEMENT_PORT
    )
  });
};
