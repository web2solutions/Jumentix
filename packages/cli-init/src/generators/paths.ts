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

/**
 * Resolve the packaged frontend template root
 * (`packages/cli-init/templates/frontend`).
 */
export function resolveFrontendTemplateRoot(packageRoot?: string): string {
  const root = packageRoot || path.resolve(__dirname, '..', '..');
  const templateRoot = path.join(root, 'templates', 'frontend');
  if (!fs.existsSync(templateRoot)) {
    throw new Error(
      `Frontend template not found at ${templateRoot}. Run bun run cli:build-templates.`
    );
  }
  return templateRoot;
}

/**
 * Collapse uncontrolled input into a safe npm name segment without
 * quantified character-class regex (avoids ReDoS on long '-' runs).
 */
export function sanitizeNpmNameSegment(value: string, fallback: string): string {
  const source = String(value || '').trim().toLowerCase();
  let out = '';
  let pendingSep = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source.charAt(i);
    if (ch === '@' || ch === '/') {
      pendingSep = out.length > 0;
    } else if (
      (ch >= 'a' && ch <= 'z')
      || (ch >= '0' && ch <= '9')
      || ch === '.'
      || ch === '_'
      || ch === '-'
    ) {
      if (pendingSep && out.length > 0) {
        out += '-';
        pendingSep = false;
      }
      out += ch;
    } else if (out.length > 0) {
      pendingSep = true;
    }
  }
  while (out.startsWith('-')) out = out.slice(1);
  while (out.endsWith('-')) out = out.slice(0, -1);
  return out || fallback;
}

/** Sanitize a project slug for use in `@<project>/<service>` package names. */
export function sanitizePackageScope(projectName: string): string {
  return sanitizeNpmNameSegment(projectName, 'app');
}

/** Sanitize a service id for use as a package name segment and folder. */
export function sanitizeServiceId(serviceId: string): string {
  return sanitizeNpmNameSegment(serviceId, 'core');
}
