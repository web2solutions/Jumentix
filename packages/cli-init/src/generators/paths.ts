import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve the packaged backend template root
 * (`packages/cli-init/templates/backend`).
 */
export function resolveBackendTemplateRoot(packageRoot?: string): string {
  const root = packageRoot || path.resolve(__dirname, '..', '..');
  const templateRoot = path.join(root, 'templates', 'backend');
  if (!fs.existsSync(templateRoot)) {
    throw new Error(
      `Backend template not found at ${templateRoot}. Run bun run cli:build-templates.`
    );
  }
  return templateRoot;
}

/** Sanitize a project slug for use in `@<project>/<service>` package names. */
export function sanitizePackageScope(projectName: string): string {
  const slug = String(projectName || 'app')
    .trim()
    .toLowerCase()
    .replace(/[@/]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'app';
}

/** Sanitize a service id for use as a package name segment and folder. */
export function sanitizeServiceId(serviceId: string): string {
  const slug = String(serviceId || 'core')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'core';
}
