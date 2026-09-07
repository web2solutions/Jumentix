const SERVICE_MANAGEMENT_LOCAL_ORIGINS = [
  'http://localhost:3200',
  'http://127.0.0.1:3200'
];

export const normalizeCatalogCorsAllowedOrigins = (configured = ''): string => {
  const origins = new Set(
    configured
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  SERVICE_MANAGEMENT_LOCAL_ORIGINS.forEach((origin) => origins.add(origin));
  return Array.from(origins).join(',');
};

export const applyCatalogCorsDefaults = (env: NodeJS.ProcessEnv = process.env): void => {
  Object.assign(env, {
    JUMENTIX_CORS_ALLOWED_ORIGINS: normalizeCatalogCorsAllowedOrigins(
      env.JUMENTIX_CORS_ALLOWED_ORIGINS
    )
  });
};
