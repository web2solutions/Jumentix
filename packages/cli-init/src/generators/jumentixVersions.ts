import fs from 'node:fs';
import path from 'node:path';

/** Resolves the version a generated project pins for one `@jumentix/*` package. */
export type JumentixPin = (packageName: string) => string;

/**
 * Public `@jumentix/*` versions recorded in `templates.manifest.json`
 * (`packageVersions`) when the templates were built (JUM-902).
 *
 * Packages version independently (Requirement 060), so one CLI version cannot
 * stand in for all of them: pinning every dependency to the CLI's own version
 * produced ranges that were never published and broke `bun install` in every
 * generated project.
 */
export function readPackageVersions(packageRoot: string): Record<string, string> {
  const manifestPath = path.join(packageRoot, 'templates.manifest.json');
  if (!fs.existsSync(manifestPath)) return {};
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      packageVersions?: Record<string, string>;
    };
    return manifest.packageVersions && typeof manifest.packageVersions === 'object'
      ? manifest.packageVersions
      : {};
  } catch {
    return {};
  }
}

/**
 * Build the pin resolver. `override` forces one version for every package
 * (tests and explicit callers); otherwise each package gets its recorded
 * version, and an unrecorded package fails closed rather than inventing one.
 */
export function resolveJumentixPin(packageRoot: string, override?: string): JumentixPin {
  if (override) return () => override;
  const versions = readPackageVersions(packageRoot);
  return (packageName: string) => {
    const version = versions[packageName];
    if (!version) {
      throw new Error(
        `No published version recorded for ${packageName} in templates.manifest.json`
        + ' (packageVersions). Rebuild templates with `bun run cli:build-templates`.'
      );
    }
    return version;
  };
}
