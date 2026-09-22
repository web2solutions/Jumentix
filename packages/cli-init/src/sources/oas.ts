import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { GenerationPlan } from './types';
import { SourceResolutionError } from './types';
import { SOURCE_MESSAGES } from './messages';
import { buildPlanFromOasDocument, type InterfaceDefaults } from './planBuilder';

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function parseDocumentText(raw: string, hintPath = ''): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SourceResolutionError(SOURCE_MESSAGES.INVALID_OAS);
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const where = hintPath ? ` in ${hintPath}` : '';
      throw new SourceResolutionError(
        `Source resolution failed: invalid JSON${where}: ${detail}`
      );
    }
  }
  try {
    return parseYaml(trimmed) as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const where = hintPath ? ` in ${hintPath}` : '';
    throw new SourceResolutionError(
      `Source resolution failed: invalid YAML${where}: ${detail}`
    );
  }
}

export function readLocalDocument(filePath: string): Record<string, unknown> {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new SourceResolutionError(SOURCE_MESSAGES.INVALID_FROM(filePath));
  }
  return parseDocumentText(fs.readFileSync(absolute, 'utf8'), absolute);
}

export function isOpenApiDocument(doc: Record<string, unknown>): boolean {
  const version = String(doc.openapi || '');
  return version.startsWith('3.') && Boolean(doc.components);
}

export function isDesignerExport(doc: Record<string, unknown>): boolean {
  if (doc.kind === 'service-management-suite') return true;
  if (Array.isArray(doc.domains) && (doc.architecture || doc.relationships || doc.view)) {
    return true;
  }
  return false;
}

/**
 * Load an OpenAPI 3.x file (YAML or JSON) into a GenerationPlan.
 */
export async function loadOasSource(
  fromPath: string,
  defaults: InterfaceDefaults
): Promise<GenerationPlan> {
  const doc = readLocalDocument(fromPath);
  if (!isOpenApiDocument(doc)) {
    throw new SourceResolutionError(SOURCE_MESSAGES.INVALID_OAS);
  }
  return buildPlanFromOasDocument(doc, defaults);
}
